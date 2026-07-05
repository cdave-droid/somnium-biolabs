/** Node-only durable audit-log pieces (kept out of the RN-portable core). */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { canonicalJson } from "./canonical.js";
import { AuditLog, verifyChain, type AuditRecord, type AuditSink } from "./m9_audit.js";

/** Durable JSONL sink: one canonical-JSON record per line, append-only. The
 * on-disk bytes are the canonical form, so the chain can be re-verified from
 * the file alone. */
export class FileAuditSink implements AuditSink {
  constructor(public path: string) {}

  write(record: AuditRecord): void {
    appendFileSync(this.path, canonicalJson(record) + "\n", "utf-8");
  }
}

/** Load a JSONL audit file, verify the chain, and return an AuditLog
 * positioned to continue appending (optionally back to the same file). */
export function loadAuditLog(path: string, sink: AuditSink | null = null): AuditLog {
  const records: AuditRecord[] = [];
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (trimmed !== "") {
        records.push(JSON.parse(trimmed));
      }
    }
  }
  verifyChain(records);
  return new AuditLog(sink, records);
}
