/** Baseline persistence (DECISIONS D8 order: profile → store → computed →
 * population). The store is consulted ONCE per evaluate() and the fetched
 * snapshot is recorded in the audit log, so replay never touches the store.
 */
import type { BaselineStore } from "./engine.js";

export class InMemoryBaselineStore implements BaselineStore {
  private data = new Map<string, Record<string, unknown>>();

  get(unitId: string): Record<string, unknown> | null {
    return this.data.get(unitId) ?? null;
  }

  put(unitId: string, baselines: Record<string, unknown>): void {
    this.data.set(unitId, baselines);
  }
}
