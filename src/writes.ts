import { mutationOperations, transportBindings } from "./catalogue.js";
import { constructWriteCoordinator, type WriteCoordinatorOptions } from "./writes-core.js";
import type { CredentialContext } from "./profiles.js";

export type { MutationTarget, MutationOperation, MutationOptions, MutationPreview, WriteCoordinatorOptions } from "./writes-core.js";

export function createWriteCoordinator(options: WriteCoordinatorOptions = {}, credentials?: CredentialContext) {
  return constructWriteCoordinator(options, { operations: mutationOperations, bindings: transportBindings, fetch: globalThis.fetch, credentials });
}
