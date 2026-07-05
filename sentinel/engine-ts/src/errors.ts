/** Mirrors engine-py/sentinel/errors.py. */

/** Raised when a content package fails validation. Fails closed. */
export class ContentError extends Error {
  messages: string[];

  constructor(messages: Iterable<string>) {
    const list = [...messages];
    super(list.join("; "));
    this.name = "ContentError";
    this.messages = list;
  }
}

/** Raised when the audit hash chain fails verification. */
export class AuditIntegrityError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "AuditIntegrityError";
  }
}
