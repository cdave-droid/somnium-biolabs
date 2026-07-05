"""Minimal JSON Schema validator (deliberate subset, zero dependencies).

Supports: type, enum, const, required, properties, additionalProperties,
items, minItems, maxItems, minLength, maxLength, pattern, minimum, maximum,
and local $ref into $defs. Content schemas are written within this subset;
the subset is mirrored in engine-ts/src/schema_validator.ts.
"""
from __future__ import annotations

import math
import re


def _type_ok(value, t: str) -> bool:
    if t == "object":
        return isinstance(value, dict)
    if t == "array":
        return isinstance(value, list)
    if t == "string":
        return isinstance(value, str)
    if t == "boolean":
        return isinstance(value, bool)
    if t == "null":
        return value is None
    if t == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if t == "integer":
        return (
            isinstance(value, (int, float))
            and not isinstance(value, bool)
            and float(value) == math.floor(value)
        )
    return False


def _deep_eq(a, b) -> bool:
    if isinstance(a, bool) or isinstance(b, bool):
        return a is b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return float(a) == float(b)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_deep_eq(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return set(a) == set(b) and all(_deep_eq(a[k], b[k]) for k in a)
    return a == b


def _resolve_ref(ref: str, root):
    if not ref.startswith("#/"):
        raise ValueError(f"only local $ref supported: {ref}")
    node = root
    for part in ref[2:].split("/"):
        if not isinstance(node, dict) or part not in node:
            raise ValueError(f"unresolvable $ref: {ref}")
        node = node[part]
    return node


def validate(instance, schema, root=None, path="$"):
    """Return a list of error strings (empty list = valid)."""
    if root is None:
        root = schema
    errors = []

    if "$ref" in schema:
        schema = _resolve_ref(schema["$ref"], root)

    t = schema.get("type")
    if t is not None:
        types = t if isinstance(t, list) else [t]
        if not any(_type_ok(instance, x) for x in types):
            errors.append(f"{path}: expected type {'|'.join(types)}, got {type(instance).__name__}")
            return errors

    if "enum" in schema and not any(_deep_eq(instance, v) for v in schema["enum"]):
        errors.append(f"{path}: value {instance!r} not in enum {schema['enum']}")
        return errors

    if "const" in schema and not _deep_eq(instance, schema["const"]):
        errors.append(f"{path}: value {instance!r} != const {schema['const']!r}")

    if isinstance(instance, str):
        if "minLength" in schema and len(instance) < schema["minLength"]:
            errors.append(f"{path}: string shorter than minLength {schema['minLength']}")
        if "maxLength" in schema and len(instance) > schema["maxLength"]:
            errors.append(f"{path}: string longer than maxLength {schema['maxLength']}")
        if "pattern" in schema and not re.search(schema["pattern"], instance):
            errors.append(f"{path}: string {instance!r} does not match pattern {schema['pattern']!r}")

    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if "minimum" in schema and instance < schema["minimum"]:
            errors.append(f"{path}: {instance} below minimum {schema['minimum']}")
        if "maximum" in schema and instance > schema["maximum"]:
            errors.append(f"{path}: {instance} above maximum {schema['maximum']}")

    if isinstance(instance, list):
        if "minItems" in schema and len(instance) < schema["minItems"]:
            errors.append(f"{path}: fewer than minItems {schema['minItems']}")
        if "maxItems" in schema and len(instance) > schema["maxItems"]:
            errors.append(f"{path}: more than maxItems {schema['maxItems']}")
        if "items" in schema:
            for i, item in enumerate(instance):
                errors.extend(validate(item, schema["items"], root, f"{path}[{i}]"))

    if isinstance(instance, dict):
        for req in schema.get("required", []):
            if req not in instance:
                errors.append(f"{path}: missing required field '{req}'")
        props = schema.get("properties", {})
        addl = schema.get("additionalProperties", True)
        for key, val in instance.items():
            if key in props:
                errors.extend(validate(val, props[key], root, f"{path}.{key}"))
            elif addl is False:
                errors.append(f"{path}: unknown field '{key}'")
            elif isinstance(addl, dict):
                errors.extend(validate(val, addl, root, f"{path}.{key}"))

    return errors
