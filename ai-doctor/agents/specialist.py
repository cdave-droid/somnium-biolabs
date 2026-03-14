"""Specialist agent that analyzes clinical cases from an organ-system perspective."""

import re
from dataclasses import dataclass, field
from pathlib import Path

from .client import DEFAULT_MODEL, rate_limited_call

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

SPECIALTIES = [
    "cardiology",
    "pulmonology",
    "nephrology",
    "neurology",
    "gastroenterology",
    "endocrinology",
    "hematology_oncology",
    "musculoskeletal",
    "infectious_disease",
    "dermatology",
]


@dataclass
class SpecialistAnalysis:
    """Structured output from a specialist agent's analysis."""

    specialist_name: str
    raw_output: str
    findings: str = ""
    differential: str = ""
    workup: str = ""
    critical: str = ""
    answer_suggestion: str = ""

    def __post_init__(self) -> None:
        self._parse_output()

    def _parse_output(self) -> None:
        """Parse labeled sections from the raw agent output."""
        sections = {
            "findings": r"RELEVANT_FINDINGS:\s*\n?(.*?)(?=\n\s*(?:DIFFERENTIAL|WORKUP|CRITICAL|ANSWER_SUGGESTION):|$)",
            "differential": r"DIFFERENTIAL:\s*\n?(.*?)(?=\n\s*(?:WORKUP|CRITICAL|ANSWER_SUGGESTION):|$)",
            "workup": r"WORKUP:\s*\n?(.*?)(?=\n\s*(?:CRITICAL|ANSWER_SUGGESTION):|$)",
            "critical": r"CRITICAL:\s*\n?(.*?)(?=\n\s*ANSWER_SUGGESTION:|$)",
            "answer_suggestion": r"ANSWER_SUGGESTION:\s*(.*?)$",
        }
        for attr, pattern in sections.items():
            match = re.search(pattern, self.raw_output, re.DOTALL)
            if match:
                setattr(self, attr, match.group(1).strip())


class SpecialistAgent:
    """An organ-system specialist that analyzes clinical cases."""

    def __init__(self, name: str, model: str = DEFAULT_MODEL) -> None:
        if name not in SPECIALTIES:
            raise ValueError(
                f"Unknown specialty: {name}. Must be one of: {SPECIALTIES}"
            )
        self.name = name
        self.model = model
        self._system_prompt = self._load_prompt()

    def _load_prompt(self) -> str:
        """Load the specialist's system prompt from the prompts directory."""
        prompt_path = PROMPTS_DIR / f"{self.name}.md"
        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
        return prompt_path.read_text()

    async def analyze(self, case: str) -> SpecialistAnalysis:
        """Analyze a clinical case from this specialist's perspective.

        Args:
            case: The clinical vignette or MCQ question text.

        Returns:
            Structured analysis from this specialist.
        """
        raw_output = await rate_limited_call(
            system=self._system_prompt,
            user_message=case,
            model=self.model,
        )
        return SpecialistAnalysis(
            specialist_name=self.name,
            raw_output=raw_output,
        )
