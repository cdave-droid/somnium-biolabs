"""Multi-stream handling (DECISIONS.md D19): per-stream screening first,
explicit fusion after — never naive interleaving of different devices.
"""
from conftest import make_obs

from sentinel import Engine


def _obs(i, typ, value, ts, source, stream_id=None):
    o = {"obs_id": f"o{i:03d}", "unit_id": "u-1", "timestamp": ts,
         "type": typ, "value": value, "source": source}
    if stream_id:
        o["stream_id"] = stream_id
    return o


CTX = {"deployment": "fixed_site"}


def test_interleaved_offset_streams_produce_no_false_artifacts(content):
    """THE core bug: two steady streams with an inter-device offset,
    interleaved at high frequency, used to trip the impossible-jump rule on
    almost every reading. Waveform rules must be per-stream."""
    obs = []
    for i, (t, v, src) in enumerate([
        ("2026-07-03T13:00:00Z", 128, "fixed_monitor"),
        ("2026-07-03T13:00:05Z", 76, "wearable_sensor"),
        ("2026-07-03T13:00:10Z", 130, "fixed_monitor"),
        ("2026-07-03T13:00:15Z", 78, "wearable_sensor"),
        ("2026-07-03T13:00:20Z", 132, "fixed_monitor"),
    ]):
        obs.append(_obs(i, "cycle_rate", v, t, src))
    out = Engine(content).evaluate({"unit_id": "u-1"}, obs, CTX)
    assert "artifact_suspected_any_input" not in out["flags"]
    assert not any("aj_cycle_rate" in t["detail"] for t in out["reasoning_trace"])
    # the 50-unit inter-device disagreement is surfaced, not silenced
    assert "stream_disagreement" in out["flags"]
    assert out["confidence"] == "degraded"


def test_jump_within_single_stream_still_caught(content):
    obs = [
        _obs(0, "saturation_pct", 96, "2026-07-03T10:00:00Z", "fixed_monitor"),
        _obs(1, "saturation_pct", 55, "2026-07-03T10:00:05Z", "fixed_monitor"),
    ]
    out = Engine(content).evaluate({"unit_id": "u-1"}, obs, CTX)
    assert any("aj_saturation" in t["detail"] for t in out["reasoning_trace"])


def test_two_devices_of_same_source_class_are_distinct_streams(content):
    """stream_id separates two wearables: each is steady, so neither may be
    jump-flagged even though their merged series oscillates."""
    obs = []
    for i, (t, v, sid) in enumerate([
        ("2026-07-03T13:00:00Z", 90, "dev-A"),
        ("2026-07-03T13:00:05Z", 140, "dev-B"),
        ("2026-07-03T13:00:10Z", 91, "dev-A"),
        ("2026-07-03T13:00:15Z", 141, "dev-B"),
    ]):
        obs.append(_obs(i, "cycle_rate", v, t, "wearable_sensor", stream_id=sid))
    out = Engine(content).evaluate({"unit_id": "u-1"}, obs, CTX)
    assert not any("aj_cycle_rate" in t["detail"] for t in out["reasoning_trace"])
    assert "stream_disagreement" in out["flags"]


def test_stream_with_dominant_artifacts_is_distrusted_wholesale(content):
    """A stream that keeps producing artifact shapes must not be believed
    selectively: its 'clean' readings are excluded too, with an explicit flag,
    while an independent trusted stream carries the case."""
    obs = [
        # wearable stream: two spike-and-recover triples -> 2 artifacts in 5
        _obs(0, "saturation_pct", 96, "2026-07-03T12:00:00Z", "wearable_sensor"),
        _obs(1, "saturation_pct", 60, "2026-07-03T12:00:30Z", "wearable_sensor"),
        _obs(2, "saturation_pct", 95, "2026-07-03T12:01:00Z", "wearable_sensor"),
        _obs(3, "saturation_pct", 58, "2026-07-03T12:01:30Z", "wearable_sensor"),
        _obs(4, "saturation_pct", 96, "2026-07-03T12:02:00Z", "wearable_sensor"),
        # independent monitor stream, later and steady
        _obs(5, "saturation_pct", 95, "2026-07-03T13:00:00Z", "fixed_monitor"),
    ]
    out = Engine(content).evaluate({"unit_id": "u-1"}, obs, CTX)
    assert "stream_untrusted" in out["flags"]
    assert any("distrusted (2/5" in t["detail"] for t in out["reasoning_trace"])
    # monitor still healthy -> no confident match from wearable garbage...
    assert out["matched_signatures"] == []
    # ...but the distrusted stream SHOWED critical values (60, 58 <= bound 80),
    # so the never-ignore-on-artifact path escalates for re-measurement
    # instead of writing them off — cautious composition, not dismissal.
    assert out["confidence"] == "insufficient"
    assert "never_ignore_breach_on_artifact" in out["flags"]
    assert out["action_tier"] == "D5"


def test_disagreement_prefers_higher_trust_source_for_logic(content):
    """Wearable says 82 (would fire the S4 signature), monitor says 96 at the
    same time. Fusion prefers the monitor; the conflict is flagged and
    confidence degraded — never silently resolved."""
    obs = [
        _obs(0, "saturation_pct", 82, "2026-07-03T13:00:00Z", "wearable_sensor"),
        _obs(1, "saturation_pct", 96, "2026-07-03T13:01:00Z", "fixed_monitor"),
    ]
    out = Engine(content).evaluate({"unit_id": "u-1"}, obs, CTX)
    assert out["matched_signatures"] == []
    assert "stream_disagreement" in out["flags"]
    assert out["confidence"] == "degraded"

    # ...but a wearable ALONE (no conflicting stream) still fires normally.
    solo = Engine(content).evaluate(
        {"unit_id": "u-1"},
        [_obs(0, "saturation_pct", 82, "2026-07-03T13:00:00Z", "wearable_sensor")], CTX)
    assert solo["matched_signatures"] == ["low_saturation_critical_v1"]


def test_agreeing_streams_do_not_flag(content):
    obs = [
        _obs(0, "saturation_pct", 95, "2026-07-03T13:00:00Z", "wearable_sensor"),
        _obs(1, "saturation_pct", 96, "2026-07-03T13:01:00Z", "fixed_monitor"),
    ]
    out = Engine(content).evaluate({"unit_id": "u-1"}, obs, CTX)
    assert "stream_disagreement" not in out["flags"]


def test_trend_uses_single_best_stream_not_pooled_offsets(content):
    """Reserve level: inline gauge is flat; a parallel offset wearable feed
    must not combine with it into a fake downward slope."""
    obs = []
    for i, (t, v) in enumerate([("2026-07-03T02:00:00Z", 50), ("2026-07-03T06:00:00Z", 50),
                                ("2026-07-03T10:00:00Z", 50), ("2026-07-03T13:00:00Z", 50)]):
        obs.append(_obs(i, "reserve_level", v, t, "inline_gauge"))
    for i, (t, v) in enumerate([("2026-07-03T03:00:00Z", 28), ("2026-07-03T07:00:00Z", 28),
                                ("2026-07-03T11:00:00Z", 28)], start=4):
        obs.append(_obs(i, "reserve_level", v, t, "wearable_sensor"))
    out = Engine(content).evaluate({"unit_id": "u-1"}, obs, CTX)
    # a pooled series would sit at 28 with a fake downward slope -> the old
    # behavior matched reserve_depletion falsely; the inline gauge (higher
    # trust, enough points) answers the signature's conditions alone
    assert "reserve_depletion_v1" not in out["matched_signatures"]
    assert not any("reserve_depletion_v1 matched" in t["detail"] for t in out["reasoning_trace"])


def test_pooling_is_last_resort_and_flagged(content):
    """No single stream has the 3 points the slope needs; pooling may proceed
    but must be flagged and degrade confidence."""
    obs = [
        _obs(0, "reserve_level", 40, "2026-07-03T02:00:00Z", "inline_gauge"),
        _obs(1, "reserve_level", 30, "2026-07-03T07:00:00Z", "inline_gauge"),
        _obs(2, "reserve_level", 20, "2026-07-03T12:00:00Z", "manual_entry"),
    ]
    out = Engine(content).evaluate({"unit_id": "u-1"}, obs, CTX)
    assert "pooled_streams" in out["flags"]
    assert out["confidence"] in ("degraded", "insufficient")


def test_invalid_stream_id_quarantined(content):
    obs = [{"obs_id": "o000", "unit_id": "u-1", "timestamp": "2026-07-03T13:00:00Z",
            "type": "cycle_rate", "value": 80, "source": "fixed_monitor",
            "stream_id": "dev-é"}]
    out = Engine(content).evaluate({"unit_id": "u-1"}, obs, CTX)
    assert any("invalid_structure:stream_id" in t["detail"] for t in out["reasoning_trace"])


def test_stream_handling_is_order_invariant(content):
    from sentinel import canonical_json
    obs = [
        _obs(0, "cycle_rate", 128, "2026-07-03T13:00:00Z", "fixed_monitor"),
        _obs(1, "cycle_rate", 76, "2026-07-03T13:00:05Z", "wearable_sensor"),
        _obs(2, "cycle_rate", 130, "2026-07-03T13:00:10Z", "fixed_monitor"),
    ]
    a = Engine(content).evaluate({"unit_id": "u-1"}, obs, CTX)
    b = Engine(content).evaluate({"unit_id": "u-1"}, list(reversed(obs)), CTX)
    for key in ("severity", "action_tier", "flags", "matched_signatures", "explanation"):
        assert a[key] == b[key]
