#!/usr/bin/env python3
"""Run a single clinical case through the multi-agent AI doctor system.

Usage:
    python run_case.py "A 55-year-old male presents with..."
    echo "clinical case text" | python run_case.py
    python run_case.py  # interactive prompt
"""

import argparse
import asyncio
import sys

from agents.orchestrator import OrchestratorAgent, SPECIALTY_DISPLAY_NAMES
from agents.client import DEFAULT_MODEL


def print_separator(title: str = "") -> None:
    width = 80
    if title:
        print(f"\n{'=' * width}")
        print(f" {title}")
        print(f"{'=' * width}")
    else:
        print(f"{'─' * width}")


async def run_case(case: str, model: str = DEFAULT_MODEL) -> None:
    """Run a clinical case through the multi-agent system and print results."""
    print_separator("MULTI-AGENT AI DOCTOR")
    print(f"\nModel: {model}")
    print(f"Specialists: 10 organ-system agents + orchestrator")
    print_separator("CLINICAL CASE")
    print(f"\n{case}\n")

    print_separator("RUNNING SPECIALIST ANALYSES")
    print("Dispatching to 10 specialist agents in parallel...\n")

    orchestrator = OrchestratorAgent(model=model)
    result = await orchestrator.diagnose(case)

    # Print each specialist's analysis
    for analysis in result.specialist_analyses:
        display_name = SPECIALTY_DISPLAY_NAMES.get(
            analysis.specialist_name, analysis.specialist_name
        )
        print_separator(f"SPECIALIST: {display_name}")
        print(f"\n{analysis.raw_output}\n")

    # Print the orchestrator's synthesis
    print_separator("ORCHESTRATOR SYNTHESIS")
    print(f"\n{result.raw_orchestrator_output}\n")

    print_separator("SUMMARY")
    print(f"\n  Best Answer: {result.best_answer or 'N/A'}")
    print(f"  Latency: {result.latency_seconds:.1f}s")
    print(f"  Specialists consulted: {len(result.specialist_analyses)}/10\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run a clinical case through the multi-agent AI doctor"
    )
    parser.add_argument(
        "case",
        nargs="?",
        help="Clinical vignette or MCQ question text",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Claude model to use (default: {DEFAULT_MODEL})",
    )
    args = parser.parse_args()

    if args.case:
        case = args.case
    elif not sys.stdin.isatty():
        case = sys.stdin.read().strip()
    else:
        print("Enter clinical case (press Ctrl+D when done):")
        case = sys.stdin.read().strip()

    if not case:
        print("Error: No clinical case provided.", file=sys.stderr)
        sys.exit(1)

    asyncio.run(run_case(case, model=args.model))


if __name__ == "__main__":
    main()
