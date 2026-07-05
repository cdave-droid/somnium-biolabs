from __future__ import annotations


class ContentError(Exception):
    """Raised when a content package fails validation. Fails closed."""

    def __init__(self, messages):
        self.messages = list(messages)
        super().__init__("; ".join(self.messages))


class AuditIntegrityError(Exception):
    """Raised when the audit hash chain fails verification."""
