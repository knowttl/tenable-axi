import { mutationOperations, transportBindings } from "./catalogue.js";
import { constructWriteCoordinator, type WriteCoordinatorOptions } from "./writes-core.js";

export type { MutationTarget, MutationOperation, MutationOptions, MutationPreview, WriteCoordinatorOptions } from "./writes-core.js";

export function createWriteCoordinator(options: WriteCoordinatorOptions = {}) {
  return constructWriteCoordinator(options, { operations: mutationOperations, bindings: transportBindings, fetch: globalThis.fetch });
}
