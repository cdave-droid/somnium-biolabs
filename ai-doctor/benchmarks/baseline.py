"""Single-call baseline solver for benchmark comparison."""

import re
import time
from dataclasses import dataclass

from agents.client import DEFAULT_MODEL, rate_limited_call

BASELINE_SYSTEM_PROMPT = """\
You are a highly experienced medical expert with comprehensive knowledge across \
all medical specialties. You are taking a medical licensing examination.

Analyze the following clinical question carefully. Consider the clinical \
presentation, relevant pathophysiology, key findings, and all answer options \
before selecting your answer.

Respond with the following format:

REASONING:
[Your step-by-step clinical reasoning]

BEST_ANSWER: [single letter A, B, C, D, or E]
"""


@dataclass
class BaselineResult:
    """Result from the single-call baseline solver."""

    best_answer: str
    reasoning: str
    raw_output: str
    latency_seconds: float = 0.0


async def baseline_solve(
    case: str,
    model: str = DEFAULT_MODEL,
) -> BaselineResult:
    """Solve a clinical MCQ with a single Claude API call (no specialist decomposition).

    Args:
        case: The formatted MCQ question text with options.
        model: Claude model to use.

    Returns:
        BaselineResult with the predicted answer and reasoning.
    """
    start = time.monotonic()

    raw_output = await rate_limited_call(
        system=BASELINE_SYSTEM_PROMPT,
        user_message=case,
        model=model,
    )

    elapsed = time.monotonic() - start

    # Extract answer
    match = re.search(r"BEST_ANSWER:\s*([A-E])", raw_output)
    answer = match.group(1) if match else ""

    # Extract reasoning
    reasoning_match = re.search(
        r"REASONING:\s*\n?(.*?)(?=\n\s*BEST_ANSWER:|$)", raw_output, re.DOTALL
    )
    reasoning = reasoning_match.group(1).strip() if reasoning_match else ""

    return BaselineResult(
        best_answer=answer,
        reasoning=reasoning,
        raw_output=raw_output,
        latency_seconds=elapsed,
    )
