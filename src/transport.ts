import { transportBindings } from "./catalogue.js";
import { constructTransport, type Transport, type TransportOptions } from "./transport-core.js";

export { TENABLE_ORIGIN, TransportError } from "./transport-core.js";
export type { ApiKeys, OperationBinding, RequestOptions, Transport, TransportOptions } from "./transport-core.js";

export function createTransport(options: TransportOptions): Transport {
  return constructTransport(options, { bindings: transportBindings, fetch: globalThis.fetch });
}
