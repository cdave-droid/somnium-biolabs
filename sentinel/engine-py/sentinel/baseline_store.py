"""Baseline persistence (DECISIONS D8 order: profile → store → computed →
population). The store is consulted ONCE per evaluate() and the fetched
snapshot is recorded in the audit log, so replay never touches the store.
"""
from __future__ import annotations

import json
import os


class InMemoryBaselineStore:
    def __init__(self):
        self._data: dict = {}

    def get(self, unit_id: str):
        return self._data.get(unit_id)

    def put(self, unit_id: str, baselines: dict):
        self._data[unit_id] = baselines


class FileBaselineStore:
    """One JSON file: {unit_id: {metric: {median, p10, p90, n_obs}}}."""

    def __init__(self, path: str):
        self.path = path

    def _load(self) -> dict:
        if not os.path.exists(self.path):
            return {}
        with open(self.path, "r", encoding="utf-8") as fh:
            return json.load(fh)

    def get(self, unit_id: str):
        return self._load().get(unit_id)

    def put(self, unit_id: str, baselines: dict):
        data = self._load()
        data[unit_id] = baselines
        with open(self.path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, sort_keys=True)
            fh.write("\n")
