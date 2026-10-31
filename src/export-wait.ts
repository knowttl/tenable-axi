import { TransportError, type Transport } from "./transport.js";

export async function exportStatus(reader: Pick<Transport, "request">, operation: string, id: string,
  decode: (body: unknown) => Record<string, unknown>, wait: boolean, initial?: Record<string, unknown>) {
  const deadline = Date.now() + 19_000;
  let job = initial;
  for (;;) {
    try {
      const response = await reader.request(operation, { pathParams: { export_id: id } });
      job = decode(response.body);
    } catch (error) {
      if (!(error instanceof TransportError) || !wait || !job) throw error;
      if (["REQUEST_BUDGET_EXCEEDED", "DEADLINE_EXCEEDED"].includes(error.error.code)) {
        return { job, complete: false, reason: "POLL_BUDGET_EXCEEDED" };
      }
      return { job, complete: false, ...error.toJSON() };
    }
    if (!wait || !["QUEUED", "PROCESSING"].includes(job.state as string)) return { job };
    if (Date.now() + 1000 >= deadline) return { job, complete: false, reason: "POLL_BUDGET_EXCEEDED" };
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  }
}
