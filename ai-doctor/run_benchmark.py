#!/usr/bin/env python3
"""Main CLI for running the multi-agent AI doctor benchmark.

Usage:
    python run_benchmark.py --dataset medqa --num-questions 100
    python run_benchmark.py --dataset medmcqa --num-questions 50 --output results/run1.json
    python run_benchmark.py --dataset medqa --num-questions 10 --model claude-sonnet-4-20250514
"""

import argparse
import asyncio
import sys

from agents.client import DEFAULT_MODEL
from benchmarks.loader import load_dataset_by_name
from benchmarks.metrics import compare_runs
from benchmarks.reporter import print_comparison_table, save_results_json, save_results_csv
from benchmarks.runner import run_multi_agent, run_baseline


async def main_async(args: argparse.Namespace) -> None:
    """Run the benchmark pipeline."""
    print(f"\nLoading {args.dataset} dataset ({args.num_questions} questions)...")
    questions = load_dataset_by_name(args.dataset, num_questions=args.num_questions)
    print(f"Loaded {len(questions)} questions.\n")

    if not questions:
        print("No questions loaded. Exiting.", file=sys.stderr)
        sys.exit(1)

    # Run multi-agent system
    print("=" * 70)
    print("  Phase 1: Multi-Agent System (10 specialists + orchestrator)")
    print("=" * 70)
    multi_agent_run = await run_multi_agent(
        questions,
        model=args.model,
        batch_size=args.batch_size,
    )

    # Run baseline
    print("\n" + "=" * 70)
    print("  Phase 2: Single-Call Baseline")
    print("=" * 70)
    baseline_run = await run_baseline(
        questions,
        model=args.model,
        batch_size=args.baseline_batch_size,
    )

    # Compare and report
    comparison = compare_runs(multi_agent_run, baseline_run)
    print_comparison_table(comparison)

    # Save results
    if args.output:
        save_results_json(multi_agent_run, baseline_run, comparison, args.output)
        csv_path = args.output.replace(".json", ".csv")
        save_results_csv(multi_agent_run, baseline_run, csv_path)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Benchmark the multi-agent AI doctor against a single-call baseline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_benchmark.py --dataset medqa --num-questions 10
  python run_benchmark.py --dataset medmcqa --num-questions 100 --output results/run.json
  python run_benchmark.py --dataset medqa --num-questions 500 --model claude-sonnet-4-20250514
        """,
    )
    parser.add_argument(
        "--dataset",
        choices=["medqa", "medmcqa"],
        default="medqa",
        help="Benchmark dataset to use (default: medqa)",
    )
    parser.add_argument(
        "--num-questions",
        type=int,
        default=10,
        help="Number of questions to evaluate (default: 10)",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Claude model to use (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=3,
        help="Concurrent questions for multi-agent (default: 3)",
    )
    parser.add_argument(
        "--baseline-batch-size",
        type=int,
        default=10,
        help="Concurrent questions for baseline (default: 10)",
    )
    parser.add_argument(
        "--output",
        help="Output file path for results JSON (e.g., results/run.json)",
    )

    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
