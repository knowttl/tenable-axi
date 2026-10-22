import { z } from "zod";

const text = z.string().min(1);
export const inventorySchema = z.strictObject({
  schemaVersion: z.literal(1),
  sources: z.array(z.strictObject({
    id: text, url: z.url(), sha256: z.string().regex(/^[a-f0-9]{64}$/), operations: z.number().int().positive(),
  })),
  operations: z.array(z.strictObject({
    source: text,
    operationId: text,
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE"]),
    path: z.string().startsWith("/"),
    disposition: z.enum(["v1-read", "v1-write", "blocked"]),
    plannedCommands: z.array(text),
    reason: text,
    slice: z.string().regex(/^T\d+$/).nullable(),
  })),
});

export type CapabilityInventory = z.infer<typeof inventorySchema>;
