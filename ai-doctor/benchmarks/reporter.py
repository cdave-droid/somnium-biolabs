"""Output formatting for benchmark results (console, JSON, CSV)."""

import csv
import json
from pathlib import Path

from tabulate import tabulate

from .metrics import BenchmarkMetrics, ComparisonResult
from .runner import BenchmarkRun


def print_comparison_table(comparison: ComparisonResult) -> None:
    """Print a formatted comparison table to the console."""
    ma = comparison.multi_agent
    bl = comparison.baseline

    # Header
    print("\n" + "=" * 70)
    print("  BENCHMARK COMPARISON: Multi-Agent vs Baseline")
    print("=" * 70)

    # Overall metrics table
    rows = [
        [
            "Overall Accuracy",
            f"{ma.overall_accuracy:.1%} ({ma.overall_correct}/{ma.overall_total})",
            f"{bl.overall_accuracy:.1%} ({bl.overall_correct}/{bl.overall_total})",
            f"{comparison.accuracy_delta:+.1%}",
        ],
        [
            "Avg Latency (s)",
            f"{ma.avg_latency_seconds:.1f}",
            f"{bl.avg_latency_seconds:.1f}",
            f"{comparison.latency_ratio:.1f}x",
        ],
        [
            "Total Time (s)",
            f"{ma.total_latency_seconds:.1f}",
            f"{bl.total_latency_seconds:.1f}",
            "",
        ],
    ]

    print(
        tabulate(
            rows,
            headers=["Metric", "Multi-Agent", "Baseline", "Delta"],
            tablefmt="grid",
        )
    )

    # Per-subject breakdown (if we have subject data from either run)
    all_subjects = set()
    ma_by_subj = {s.subject: s for s in ma.by_subject}
    bl_by_subj = {s.subject: s for s in bl.by_subject}
    all_subjects = set(ma_by_subj.keys()) | set(bl_by_subj.keys())

    if len(all_subjects) > 1:
        print(f"\n{'─' * 70}")
        print("  Per-Subject Accuracy")
        print(f"{'─' * 70}")

        subject_rows = []
        for subj in sorted(all_subjects):
            ma_subj = ma_by_subj.get(subj)
            bl_subj = bl_by_subj.get(subj)
            ma_acc = f"{ma_subj.accuracy:.1%}" if ma_subj else "N/A"
            bl_acc = f"{bl_subj.accuracy:.1%}" if bl_subj else "N/A"
            count = ma_subj.total if ma_subj else (bl_subj.total if bl_subj else 0)
            subject_rows.append([subj, ma_acc, bl_acc, count])

        print(
            tabulate(
                subject_rows,
                headers=["Subject", "Multi-Agent", "Baseline", "N"],
                tablefmt="grid",
            )
        )

    print()


def save_results_json(
    multi_agent_run: BenchmarkRun,
    baseline_run: BenchmarkRun,
    comparison: ComparisonResult,
    output_path: str | Path,
) -> None:
    """Save full results to a JSON file."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "comparison": {
            "accuracy_delta": comparison.accuracy_delta,
            "latency_ratio": comparison.latency_ratio,
        },
        "multi_agent": _run_to_dict(multi_agent_run, comparison.multi_agent),
        "baseline": _run_to_dict(baseline_run, comparison.baseline),
    }

    output_path.write_text(json.dumps(data, indent=2))
    print(f"Results saved to: {output_path}")


def save_results_csv(
    multi_agent_run: BenchmarkRun,
    baseline_run: BenchmarkRun,
    output_path: str | Path,
) -> None:
    """Save per-question results to a CSV file."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Build a mapping of question_id -> results from both runs
    ma_results = {r.question_id: r for r in multi_agent_run.results}
    bl_results = {r.question_id: r for r in baseline_run.results}
    all_ids = sorted(set(ma_results.keys()) | set(bl_results.keys()))

    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "question_id",
            "subject_area",
            "correct_answer",
            "multi_agent_answer",
            "multi_agent_correct",
            "multi_agent_latency_s",
            "baseline_answer",
            "baseline_correct",
            "baseline_latency_s",
        ])

        for qid in all_ids:
            ma = ma_results.get(qid)
            bl = bl_results.get(qid)
            writer.writerow([
                qid,
                ma.subject_area if ma else (bl.subject_area if bl else ""),
                ma.correct_answer if ma else (bl.correct_answer if bl else ""),
                ma.predicted_answer if ma else "",
                ma.is_correct if ma else "",
                f"{ma.latency_seconds:.2f}" if ma else "",
                bl.predicted_answer if bl else "",
                bl.is_correct if bl else "",
                f"{bl.latency_seconds:.2f}" if bl else "",
            ])

    csv_path = str(output_path).replace(".json", ".csv")
    if csv_path == str(output_path):
        csv_path = str(output_path) + ".csv"
    print(f"CSV results saved to: {output_path}")


def _run_to_dict(run: BenchmarkRun, metrics: BenchmarkMetrics) -> dict:
    """Convert a benchmark run and its metrics to a JSON-serializable dict."""
    return {
        "solver_name": run.solver_name,
        "model": run.model,
        "dataset": run.dataset,
        "overall_accuracy": metrics.overall_accuracy,
        "overall_correct": metrics.overall_correct,
        "overall_total": metrics.overall_total,
        "avg_latency_seconds": metrics.avg_latency_seconds,
        "total_latency_seconds": metrics.total_latency_seconds,
        "by_subject": [
            {
                "subject": s.subject,
                "accuracy": s.accuracy,
                "correct": s.correct,
                "total": s.total,
            }
            for s in metrics.by_subject
        ],
        "results": [
            {
                "question_id": r.question_id,
                "predicted_answer": r.predicted_answer,
                "correct_answer": r.correct_answer,
                "is_correct": r.is_correct,
                "latency_seconds": r.latency_seconds,
                "subject_area": r.subject_area,
            }
            for r in run.results
        ],
    }
