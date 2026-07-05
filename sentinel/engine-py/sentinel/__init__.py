"""SENTINEL — Signal Evaluation & Notification with Tiered Intervention &
Escalation Logic. Python reference runtime.

Public API (§4 of the spec):
    load_content(package_path) -> ContentHandle
    Engine(content).evaluate(unit_profile, observations, context) -> EngineOutput
    Engine.open_case / evaluate_stream — incremental watch-mode
    Engine.replay(audit_records) — byte-identical reproduction (release gate)
    explain(engine_output, audience) -> str
"""
from .canonical import canonical_json, deterministic_uuid, q6, sha256_hex
from .constants import ENGINE_VERSION
from .content import load_content
from .engine import Engine, explain
from .errors import AuditIntegrityError, ContentError
from .m9_audit import verify_chain

__all__ = [
    "AuditIntegrityError", "ContentError", "Engine", "ENGINE_VERSION",
    "canonical_json", "deterministic_uuid", "explain", "load_content",
    "q6", "sha256_hex", "verify_chain",
]
