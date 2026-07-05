/** Minimal JSON Schema validator (deliberate subset, zero dependencies).
 *
 * Supports: type, enum, const, required, properties, additionalProperties,
 * items, minItems, maxItems, minLength, maxLength, pattern, minimum, maximum,
 * and local $ref into $defs. Content schemas are written within this subset;
 * this mirrors engine-py/sentinel/schema_validator.py, including the exact
 * error-message strings (Python !r quoting is reproduced by pyRepr below).
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isPlainObject(v: unknown): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function typeOk(value: unknown, t: string): boolean {
  if (t === "object") {
    return isPlainObject(value);
  }
  if (t === "array") {
    return Array.isArray(value);
  }
  if (t === "string") {
    return typeof value === "string";
  }
  if (t === "boolean") {
    return typeof value === "boolean";
  }
  if (t === "null") {
    return value === null;
  }
  if (t === "number") {
    return typeof value === "number";
  }
  if (t === "integer") {
    return typeof value === "number" && value === Math.floor(value);
  }
  return false;
}

function deepEq(a: unknown, b: unknown): boolean {
  if (typeof a === "boolean" || typeof b === "boolean") {
    return a === b;
  }
  if (typeof a === "number" && typeof b === "number") {
    return a === b;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEq(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    const kb = new Set(Object.keys(b));
    if (ka.length !== kb.size) {
      return false;
    }
    return ka.every((k) => kb.has(k) && deepEq(a[k], b[k]));
  }
  return a === b;
}

function resolveRef(ref: string, root: Record<string, Json>): Record<string, Json> {
  if (!ref.startsWith("#/")) {
    throw new Error(`only local $ref supported: ${ref}`);
  }
  let node: Json = root as Json;
  for (const part of ref.slice(2).split("/")) {
    if (!isPlainObject(node) || !Object.prototype.hasOwnProperty.call(node, part)) {
      throw new Error(`unresolvable $ref: ${ref}`);
    }
    node = node[part];
  }
  return node as Record<string, Json>;
}

/** Python type(x).__name__ as it appears in the reference error messages. */
function pyTypeName(v: unknown): string {
  if (v === null || v === undefined) return "NoneType";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number") return Number.isInteger(v) ? "int" : "float";
  if (typeof v === "string") return "str";
  if (Array.isArray(v)) return "list";
  return "dict";
}

/** Python repr() approximation for error-message fidelity. */
export function pyRepr(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "number") return pyNumStr(v);
  if (typeof v === "string") {
    const hasSingle = v.includes("'");
    const hasDouble = v.includes('"');
    const q = hasSingle && !hasDouble ? '"' : "'";
    let out = q;
    for (const ch of v) {
      if (ch === "\\") out += "\\\\";
      else if (ch === q) out += "\\" + q;
      else if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "\\r";
      else if (ch === "\t") out += "\\t";
      else {
        const c = ch.codePointAt(0) as number;
        if (c < 0x20 || c === 0x7f) out += "\\x" + c.toString(16).padStart(2, "0");
        else out += ch;
      }
    }
    return out + q;
  }
  if (Array.isArray(v)) {
    return "[" + v.map((x) => pyRepr(x)).join(", ") + "]";
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return "{" + Object.keys(o).map((k) => pyRepr(k) + ": " + pyRepr(o[k])).join(", ") + "}";
  }
  return String(v);
}

/** Python str() of a number inside an f-string. */
function pyNumStr(x: number): string {
  return String(x);
}

/** Python str() as used by f-string interpolation of schema values. */
function pyStr(v: unknown): string {
  if (typeof v === "string") return v;
  return pyRepr(v);
}

/** Return a list of error strings (empty list = valid). */
export function validate(
  instance: Json,
  schema: Record<string, Json>,
  root?: Record<string, Json>,
  path = "$",
): string[] {
  if (root === undefined) {
    root = schema;
  }
  const errors: string[] = [];

  if ("$ref" in schema) {
    schema = resolveRef(schema["$ref"] as string, root);
  }

  const t = schema["type"];
  if (t !== undefined && t !== null) {
    const types = Array.isArray(t) ? (t as string[]) : [t as string];
    if (!types.some((x) => typeOk(instance, x))) {
      errors.push(`${path}: expected type ${types.join("|")}, got ${pyTypeName(instance)}`);
      return errors;
    }
  }

  if ("enum" in schema && !(schema["enum"] as Json[]).some((v) => deepEq(instance, v))) {
    errors.push(`${path}: value ${pyRepr(instance)} not in enum ${pyStr(schema["enum"])}`);
    return errors;
  }

  if ("const" in schema && !deepEq(instance, schema["const"])) {
    errors.push(`${path}: value ${pyRepr(instance)} != const ${pyRepr(schema["const"])}`);
  }

  if (typeof instance === "string") {
    if ("minLength" in schema && instance.length < (schema["minLength"] as number)) {
      errors.push(`${path}: string shorter than minLength ${pyStr(schema["minLength"])}`);
    }
    if ("maxLength" in schema && instance.length > (schema["maxLength"] as number)) {
      errors.push(`${path}: string longer than maxLength ${pyStr(schema["maxLength"])}`);
    }
    if ("pattern" in schema && !new RegExp(schema["pattern"] as string).test(instance)) {
      errors.push(`${path}: string ${pyRepr(instance)} does not match pattern ${pyRepr(schema["pattern"])}`);
    }
  }

  if (typeof instance === "number") {
    if ("minimum" in schema && instance < (schema["minimum"] as number)) {
      errors.push(`${path}: ${pyNumStr(instance)} below minimum ${pyStr(schema["minimum"])}`);
    }
    if ("maximum" in schema && instance > (schema["maximum"] as number)) {
      errors.push(`${path}: ${pyNumStr(instance)} above maximum ${pyStr(schema["maximum"])}`);
    }
  }

  if (Array.isArray(instance)) {
    if ("minItems" in schema && instance.length < (schema["minItems"] as number)) {
      errors.push(`${path}: fewer than minItems ${pyStr(schema["minItems"])}`);
    }
    if ("maxItems" in schema && instance.length > (schema["maxItems"] as number)) {
      errors.push(`${path}: more than maxItems ${pyStr(schema["maxItems"])}`);
    }
    if ("items" in schema) {
      instance.forEach((item, i) => {
        errors.push(...validate(item, schema["items"] as Record<string, Json>, root, `${path}[${i}]`));
      });
    }
  }

  if (isPlainObject(instance)) {
    const required = (schema["required"] as string[] | undefined) ?? [];
    for (const req of required) {
      if (!Object.prototype.hasOwnProperty.call(instance, req)) {
        errors.push(`${path}: missing required field '${req}'`);
      }
    }
    const props = (schema["properties"] as Record<string, Json> | undefined) ?? {};
    const addl = "additionalProperties" in schema ? schema["additionalProperties"] : true;
    for (const key of Object.keys(instance)) {
      const val = instance[key];
      if (Object.prototype.hasOwnProperty.call(props, key)) {
        errors.push(...validate(val, props[key] as Record<string, Json>, root, `${path}.${key}`));
      } else if (addl === false) {
        errors.push(`${path}: unknown field '${key}'`);
      } else if (isPlainObject(addl)) {
        errors.push(...validate(val, addl, root, `${path}.${key}`));
      }
    }
  }

  return errors;
}
