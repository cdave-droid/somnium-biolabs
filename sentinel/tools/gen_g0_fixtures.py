#!/usr/bin/env python3
"""Generates the committed G0 malformed-content fixture set (20 files) plus
expectations.json mapping each file to the error substring the validator must
emit. Re-run only if the fixture set is deliberately being changed.
"""
from __future__ import annotations

import copy
import json
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "content", "tests", "malformed")

BASE_SIG = {
    "signature_id": "zz_malformed_v1",
    "version": "1.0.0",
    "status": "published",
    "name": "Malformed fixture",
    "author": "fixture",
    "reviewers": ["fixture"],
    "required_inputs": ["cycle_rate"],
    "logic": {"all_of": [{"id": "c1", "metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 60}]},
    "severity": "S2",
    "action_tier_by_context": {"default": "D2"},
    "explanation_template": "Cycle rate is {v}.",
    "template_bindings": {"v": {"condition_id": "c1", "field": "value", "round": 0}},
}


def _mut(**changes):
    doc = copy.deepcopy(BASE_SIG)
    for key, value in changes.items():
        if value is None:
            doc.pop(key, None)
        else:
            doc[key] = value
    return doc


def build():
    fixtures = {}

    fixtures["01_missing_severity.json"] = (_mut(severity=None), "missing required field 'severity'")
    fixtures["02_bad_severity_enum.json"] = (_mut(severity="S9"), "not in enum")
    fixtures["03_unknown_operator.json"] = (
        _mut(logic={"all_of": [{"id": "c1", "metric": "cycle_rate", "op": "median_of", "value": 1, "window_min": 60}]}),
        "not in enum")
    fixtures["04_no_default_tier.json"] = (_mut(action_tier_by_context={"fixed_site": "D4"}), "missing required field 'default'")
    fixtures["05_unbound_template_var.json"] = (_mut(explanation_template="Rate rose {oops}%.", template_bindings={}), "has no binding")
    fixtures["06_binding_bad_condition.json"] = (
        _mut(template_bindings={"v": {"condition_id": "nope", "field": "value"}}), "unknown condition id")
    fixtures["07_duplicate_condition_ids.json"] = (
        _mut(logic={"all_of": [
            {"id": "c1", "metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 60},
            {"id": "c1", "metric": "cycle_rate", "op": "lte", "value": 200, "window_min": 60}]}),
        "duplicate condition id")
    fixtures["08_unknown_metric.json"] = (
        _mut(logic={"all_of": [{"id": "c1", "metric": "voltage", "op": "gte", "value": 1, "window_min": 60}]}),
        "unknown metric")
    fixtures["09_trend_slope_no_min_points.json"] = (
        _mut(logic={"all_of": [{"id": "c1", "metric": "cycle_rate", "op": "trend_slope", "gte": 0.1, "window_min": 60}]},
             explanation_template="Slope {v}.", template_bindings={"v": {"condition_id": "c1", "field": "slope"}}),
        "trend_slope requires 'min_points'")
    fixtures["10_raw_op_no_window.json"] = (
        _mut(logic={"all_of": [{"id": "c1", "metric": "cycle_rate", "op": "gte", "value": 100}]}),
        "requires 'window_min'")
    fixtures["11_unknown_flag.json"] = (
        _mut(logic={"all_of": [
            {"id": "c1", "metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 60},
            {"none_of": [{"flag": "made_up_flag"}]}]}),
        "unknown flag")
    fixtures["12_unknown_event_code.json"] = (
        _mut(logic={"all_of": [{"op": "event_present", "event_id": "EV_NOT_A_CODE", "window_min": 60},
                               {"id": "c1", "metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 60}]}),
        "not in controlled vocabulary")
    fixtures["13_bad_version_format.json"] = (_mut(version="1.0"), "does not match pattern")
    fixtures["14_unknown_extra_field.json"] = (_mut(surprise=True), "unknown field 'surprise'")
    fixtures["15_wrong_type_priority.json"] = (_mut(priority="high"), "expected type integer")
    fixtures["16_empty_required_inputs.json"] = (_mut(required_inputs=[]), "fewer than minItems")
    fixtures["17_at_least_n_missing_n.json"] = (
        _mut(logic={"at_least_n_of": {"of": [{"id": "c1", "metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 60}]}}),
        "missing required field 'n'")
    fixtures["18_out_of_range_tier.json"] = (_mut(action_tier_by_context={"default": "D9"}), "not in enum")
    fixtures["19_negative_window.json"] = (
        _mut(logic={"all_of": [{"id": "c1", "metric": "cycle_rate", "op": "gte", "value": 100, "window_min": -5}]}),
        "below minimum")
    fixtures["20_two_comparators.json"] = (
        _mut(logic={"all_of": [{"id": "c1", "metric": "cycle_rate", "op": "delta_from_baseline_pct",
                                "gte": 20, "lte": 40, "window_min": 60}]},
             explanation_template="Delta {v}.", template_bindings={"v": {"condition_id": "c1", "field": "delta_pct"}}),
        "exactly one of gte/lte/eq")

    fixtures["21_baseline_status_with_op.json"] = (
        _mut(logic={"all_of": [{"id": "c1", "metric": "cycle_rate", "baseline_status": "personalized",
                                "op": "gte", "value": 100, "window_min": 60}]}),
        "must not combine 'baseline_status' with 'op'")
    fixtures["22_two_combinators_one_node.json"] = (
        _mut(logic={"all_of": [{"id": "c1", "metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 60}],
                    "any_of": [{"metric": "cycle_rate", "op": "lte", "value": 200, "window_min": 60}]}),
        "multiple combinator keys")
    fixtures["23_baseline_status_unknown_metric.json"] = (
        _mut(logic={"all_of": [{"id": "c1", "metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 60},
                               {"metric": "voltage", "baseline_status": "personalized"}]}),
        "unknown metric 'voltage'")
    fixtures["24_raw_op_value_type_mismatch.json"] = (
        _mut(logic={"all_of": [{"id": "c1", "metric": "cycle_rate", "op": "gte", "value": "R2", "window_min": 60}]}),
        "value must be numeric for metric")
    fixtures["25_at_least_n_exceeds_options.json"] = (
        _mut(logic={"at_least_n_of": {"n": 3, "of": [
            {"id": "c1", "metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 60}]}}),
        "exceeds available conditions")
    fixtures["26_event_present_without_event_input.json"] = (
        _mut(logic={"all_of": [{"op": "event_present", "event_id": "EV_POWER_LOSS", "window_min": 60},
                               {"id": "c1", "metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 60}]}),
        "required_inputs does not list 'event'")

    os.makedirs(OUT, exist_ok=True)
    expectations = {}
    for name, (doc, expect) in sorted(fixtures.items()):
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
            json.dump(doc, fh, indent=2)
            fh.write("\n")
        expectations[name] = expect
    with open(os.path.join(OUT, "expectations.json"), "w", encoding="utf-8") as fh:
        json.dump(expectations, fh, indent=2)
        fh.write("\n")
    print(f"wrote {len(fixtures)} malformed fixtures to {os.path.normpath(OUT)}")


if __name__ == "__main__":
    build()
