/** M9 — Audit & Outcome Logger. Append-only, hash-chained (each record embeds
 * the previous record's hash; recomputation detects any later tampering).
 */
import { canonicalJson, sha256Hex } from "./canonical.js";
import { AuditIntegrityError } from "./errors.js";

export const GENESIS_HASH = "0".repeat(64);

export interface AuditRecord {
  seq: number;
  record_type: string;
  case_id: string;
  engine_version: string;
  content_version: string;
  payload: unknown;
  prev_hash: string;
  hash: string;
}

export class AuditLog {
  records: AuditRecord[] = [];

  append(
    recordType: string,
    caseId: string,
    engineVersion: string,
    contentVersion: string,
    payload: unknown,
  ): AuditRecord {
    const prevHash = this.records.length > 0 ? this.records[this.records.length - 1].hash : GENESIS_HASH;
    const body = {
      seq: this.records.length + 1,
      record_type: recordType,
      case_id: caseId,
      engine_version: engineVersion,
      content_version: contentVersion,
      payload,
      prev_hash: prevHash,
    };
    const record: AuditRecord = { ...body, hash: sha256Hex(canonicalJson(body)) };
    this.records.push(record);
    return record;
  }
}

/** Throws AuditIntegrityError at the first tampered or unlinked record. */
export function verifyChain(records: AuditRecord[]): boolean {
  let prev = GENESIS_HASH;
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
      if (k !== "hash") {
        body[k] = v;
      }
    }
    if (record.prev_hash !== prev) {
      throw new AuditIntegrityError(`record ${i + 1}: prev_hash does not link to previous record`);
    }
    if (record.seq !== i + 1) {
      throw new AuditIntegrityError(`record ${i + 1}: seq mismatch`);
    }
    const expected = sha256Hex(canonicalJson(body));
    if (record.hash !== expected) {
      throw new AuditIntegrityError(`record ${i + 1}: hash mismatch (tampering detected)`);
    }
    prev = record.hash;
  }
  return true;
}
