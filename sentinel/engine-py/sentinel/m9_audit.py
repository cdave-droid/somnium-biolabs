"""M9 — Audit & Outcome Logger. Append-only, hash-chained (each record embeds
the previous record's hash; recomputation detects any later tampering).
"""
from __future__ import annotations

from .canonical import canonical_json, sha256_hex
from .errors import AuditIntegrityError

GENESIS_HASH = "0" * 64


class AuditLog:
    def __init__(self):
        self.records = []

    def append(self, record_type, case_id, engine_version, content_version, payload):
        prev_hash = self.records[-1]["hash"] if self.records else GENESIS_HASH
        record = {
            "seq": len(self.records) + 1,
            "record_type": record_type,
            "case_id": case_id,
            "engine_version": engine_version,
            "content_version": content_version,
            "payload": payload,
            "prev_hash": prev_hash,
        }
        record["hash"] = sha256_hex(canonical_json(record))
        self.records.append(record)
        return record


def verify_chain(records):
    """Raises AuditIntegrityError at the first tampered or unlinked record."""
    prev = GENESIS_HASH
    for i, record in enumerate(records):
        body = {k: v for k, v in record.items() if k != "hash"}
        if record.get("prev_hash") != prev:
            raise AuditIntegrityError(f"record {i + 1}: prev_hash does not link to previous record")
        if record.get("seq") != i + 1:
            raise AuditIntegrityError(f"record {i + 1}: seq mismatch")
        expected = sha256_hex(canonical_json(body))
        if record.get("hash") != expected:
            raise AuditIntegrityError(f"record {i + 1}: hash mismatch (tampering detected)")
        prev = record["hash"]
    return True
