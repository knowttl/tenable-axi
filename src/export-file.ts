import { randomUUID } from "node:crypto";
import { closeSync, fsyncSync, linkSync, lstatSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { SecretRedactor } from "./redact.js";
import { TransportError } from "./transport-core.js";

const ceiling = 128 * 1024 * 1024;

// Parse CSV before scanning so quoted delimiters, newlines and sensitive columns
// have the same redaction semantics as JSON properties.
function csv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { cell += '"'; index++; }
        else { quoted = false; closed = true; }
      } else cell += char;
    } else if (char === '"' && !cell && !closed) quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; closed = false; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(cell); rows.push(row); row = []; cell = ""; closed = false;
    } else {
      if (closed || char === '"') throw new Error("Invalid CSV quoting");
      cell += char;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  if (!rows.length || rows[0]!.some((name) => !name) || rows.some((row) => row.length !== rows[0]!.length)) throw new Error("Invalid CSV rows");
  return rows;
}

export function exportOutputPath(path: string, operation: string): string {
  const output = resolve(path);
  try {
    lstatSync(output);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return output;
    throw new TransportError({ code: "OUTPUT_FAILED", message: "Cannot inspect output destination", operation });
  }
  throw new TransportError({ code: "OUTPUT_EXISTS", message: "Output must be a new file; choose another path", operation });
}

export function saveExport(contents: unknown, output: string, redactor: SecretRedactor, operation: string) {
  const invalid = (): never => { throw new TransportError({ code: "RESPONSE_INVALID", message: "Export must be valid bounded JSON or CSV, optionally gzip compressed", operation }); };
  if (!Buffer.isBuffer(contents) || contents.length > ceiling) invalid();
  const source = contents as Buffer;
  const compressed = source[0] === 0x1f && source[1] === 0x8b;
  let bytes: Buffer;
  let format: string;
  try {
    const decoded = compressed ? gunzipSync(source, { maxOutputLength: ceiling }) : source;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(decoded).replace(/^\uFEFF/, "");
    if (!text.trim()) invalid();
    const normalize = (key: string) => key.toLowerCase().replace(/[ -]/g, "_");
    const scan = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(scan);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => {
        const name = normalize(key);
        return [redactor.text(key), (redactor.payload({ [name]: scan(child) }) as Record<string, unknown>)[name]];
      }));
      return redactor.payload(value);
    };
    let safe: string;
    if (/^\s*[\[{]/.test(text)) {
      const value: unknown = JSON.parse(text);
      if (!Array.isArray(value) || value.some((row) => !row || typeof row !== "object" || Array.isArray(row))) invalid();
      format = "JSON";
      safe = JSON.stringify(scan(value));
    } else {
      const rows = csv(text);
      const headers = rows[0]!;
      if (headers.some((header) => /[<>\r\n]/.test(header))) invalid();
      format = "CSV";
      const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
      safe = rows.map((row, index) => row.map((cell, column) => {
        const key = normalize(headers[column]!);
        const value = index === 0 ? redactor.payload(cell) : (redactor.payload({ [key]: cell }) as Record<string, string>)[key];
        return quote(String(value));
      }).join(",")).join("\n");
    }
    const encoded = Buffer.from(safe);
    if (encoded.length > ceiling) invalid();
    bytes = compressed ? gzipSync(encoded) : encoded;
    if (bytes.length > ceiling) invalid();
  } catch { return invalid(); }
  const temporary = join(dirname(output), `.tenable-export-${randomUUID()}.tmp`);
  let fd: number | undefined;
  let created = false;
  try {
    fd = openSync(temporary, "wx", 0o600);
    created = true;
    writeFileSync(fd, bytes);
    fsyncSync(fd);
    closeSync(fd); fd = undefined;
    // A hard link publishes the completed file atomically and refuses even a
    // destination created after the initial existence check.
    linkSync(temporary, output);
    return { output, bytes: bytes.length, format, compressed };
  } catch (error) {
    throw new TransportError({ code: (error as NodeJS.ErrnoException).code === "EEXIST" ? "OUTPUT_EXISTS" : "OUTPUT_FAILED",
      message: "Export file could not be published; choose a new writable output path", operation });
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (created) unlinkSync(temporary);
  }
}
