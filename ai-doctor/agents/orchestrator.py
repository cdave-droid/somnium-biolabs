"""Orchestrator agent that synthesizes specialist analyses into a unified diagnosis."""

import asyncio
import re
import time
from dataclasses import dataclass, field
from pathlib import Path

from .client import DEFAULT_MODEL, rate_limited_call
from .specialist import SPECIALTIES, SpecialistAgent, SpecialistAnalysis

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

SPECIALTY_DISPLAY_NAMES = {
    "cardiology": "Cardiology",
    "pulmonology": "Pulmonology",
    "nephrology": "Nephrology",
    "neurology": "Neurology",
    "gastroenterology": "Gastroenterology",
    "endocrinology": "Endocrinology",
    "hematology_oncology": "Hematology/Oncology",
    "musculoskeletal": "Musculoskeletal/Rheumatology",
    "infectious_disease": "Infectious Disease",
    "dermatology": "Dermatology",
}


@dataclass
class DiagnosisResult:
    """Result from the orchestrator's multi-agent diagnosis."""

    case: str
    best_answer: str
    reasoning: str
    synthesis: str
    differential: str
    raw_orchestrator_output: str
    specialist_analyses: list[SpecialistAnalysis] = field(default_factory=list)
    latency_seconds: float = 0.0


class OrchestratorAgent:
    """Orchestrates multi-specialist analysis and synthesizes a unified diagnosis."""

    def __init__(self, model: str = DEFAULT_MODEL) -> None:
        self.model = model
        self._system_prompt = self._load_prompt()
        self._specialists = [
            SpecialistAgent(name, model=model) for name in SPECIALTIES
        ]

    def _load_prompt(self) -> str:
        prompt_path = PROMPTS_DIR / "orchestrator.md"
        if not prompt_path.exists():
            raise FileNotFoundError(f"Orchestrator prompt not found: {prompt_path}")
        return prompt_path.read_text()

    async def diagnose(self, case: str) -> DiagnosisResult:
        """Run all specialists in parallel, then synthesize their outputs.

        Args:
            case: The clinical vignette or MCQ question text.

        Returns:
            Unified diagnosis result.
        """
        start_time = time.monotonic()

        # Dispatch all specialists in parallel
        tasks = [specialist.analyze(case) for specialist in self._specialists]
        analyses = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out failures, keeping successful analyses
        successful: list[SpecialistAnalysis] = []
        for i, result in enumerate(analyses):
            if isinstance(result, Exception):
                print(
                    f"  Warning: {SPECIALTIES[i]} specialist failed: {result}"
                )
            else:
                successful.append(result)

        # Build the synthesis prompt
        user_message = self._build_synthesis_message(case, successful)

        # Call the orchestrator
        raw_output = await rate_limited_call(
            system=self._system_prompt,
            user_message=user_message,
            model=self.model,
        )

        elapsed = time.monotonic() - start_time

        return DiagnosisResult(
            case=case,
            best_answer=self._extract_answer(raw_output),
            reasoning=self._extract_section(raw_output, "REASONING"),
            synthesis=self._extract_section(raw_output, "SYNTHESIS"),
            differential=self._extract_section(raw_output, "FINAL_DIFFERENTIAL"),
            raw_orchestrator_output=raw_output,
            specialist_analyses=successful,
            latency_seconds=elapsed,
        )

    def _build_synthesis_message(
        self, case: str, analyses: list[SpecialistAnalysis]
    ) -> str:
        """Build the user message for the orchestrator with all specialist outputs."""
        parts = [f"## Original Case\n\n{case}\n\n## Specialist Analyses\n"]
        for analysis in analyses:
            display_name = SPECIALTY_DISPLAY_NAMES.get(
                analysis.specialist_name, analysis.specialist_name
            )
            parts.append(f"### {display_name}\n\n{analysis.raw_output}\n")
        return "\n".join(parts)

    @staticmethod
    def _extract_answer(text: str) -> str:
        """Extract the BEST_ANSWER letter from orchestrator output."""
        match = re.search(r"BEST_ANSWER:\s*([A-E])", text)
        return match.group(1) if match else ""

    @staticmethod
    def _extract_section(text: str, section: str) -> str:
        """Extract a labeled section from the orchestrator output."""
        pattern = rf"{section}:\s*\n?(.*?)(?=\n\s*(?:SYNTHESIS|FINAL_DIFFERENTIAL|BEST_ANSWER|REASONING):|$)"
        match = re.search(pattern, text, re.DOTALL)
        return match.group(1).strip() if match else ""
