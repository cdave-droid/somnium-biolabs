/** SENTINEL — Signal Evaluation & Notification with Tiered Intervention &
 * Escalation Logic. TypeScript runtime (React-Native-portable core; the only
 * Node-specific module is content_node.ts).
 */
export { canonicalJson, deterministicUuid, fmtNum, fmtVal, q6, sha256Hex } from "./canonical.js";
export { ENGINE_VERSION, FLAG_TEXTS, SEVERITIES, TIERS } from "./constants.js";
export { loadContentFromReader, mapReader, type ContentHandle } from "./content.js";
export { loadContent } from "./content_node.js";
export { Engine, explain, type BaselineStore, type CaseHandle, type EngineOutput } from "./engine.js";
export { InMemoryBaselineStore } from "./baseline_store.js";
export { FileAuditSink, loadAuditLog } from "./m9_audit_node.js";
export { AuditIntegrityError, ContentError } from "./errors.js";
export { AuditLog, verifyChain, type AuditRecord, type AuditSink } from "./m9_audit.js";
export { fmtTs, parseTs } from "./timeutil.js";
