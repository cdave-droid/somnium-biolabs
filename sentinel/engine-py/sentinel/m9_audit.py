"""M9 — Audit & Outcome Logger. Append-only, hash-chained (each record embeds
the previous record's hash; recomputation detects any later tampering).
"""
from __future__ import annotations

from .canonical import canonical_json, sha256_hex
from .errors import AuditIntegrityError

GENESIS_HASH = "0" * 64


class FileAuditSink:
    """Durable JSONL sink: one canonical-JSON record per line, append-only.
    The on-disk bytes are the canonical form, so the chain can be re-verified
    from the file alone."""

    def __init__(self, path):
        self.path = path

    def write(self, record):
        with open(self.path, "a", encoding="utf-8") as fh:
            fh.write(canonical_json(record) + "\n")


class AuditLog:
    def __init__(self, sink=None, records=None):
        self.records = list(records) if records else []
        self.sink = sink

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
        if self.sink is not None:
            self.sink.write(record)
        return record

    def chain_head(self):
        """Current chain-head hash — publish/countersign this externally to
        make whole-log truncation detectable (anchoring is the caller's job)."""
        return self.records[-1]["hash"] if self.records else GENESIS_HASH


def load_audit_log(path, sink=None):
    """Load a JSONL audit file, verify the chain, and return an AuditLog
    positioned to continue appending (optionally back to the same file)."""
    import json

    records = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    verify_chain(records)
    return AuditLog(sink=sink, records=records)


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
