"""Accuracy and comparison metrics for benchmark results."""

from collections import defaultdict
from dataclasses import dataclass, field

from .runner import BenchmarkRun


@dataclass
class SubjectAccuracy:
    """Accuracy for a single subject area."""

    subject: str
    correct: int
    total: int

    @property
    def accuracy(self) -> float:
        return self.correct / self.total if self.total > 0 else 0.0


@dataclass
class BenchmarkMetrics:
    """Computed metrics for a benchmark run."""

    solver_name: str
    overall_correct: int = 0
    overall_total: int = 0
    by_subject: list[SubjectAccuracy] = field(default_factory=list)
    avg_latency_seconds: float = 0.0
    total_latency_seconds: float = 0.0

    @property
    def overall_accuracy(self) -> float:
        return self.overall_correct / self.overall_total if self.overall_total > 0 else 0.0


def compute_metrics(run: BenchmarkRun) -> BenchmarkMetrics:
    """Compute accuracy metrics from a benchmark run.

    Args:
        run: Completed benchmark run with results.

    Returns:
        BenchmarkMetrics with overall and per-subject accuracy.
    """
    metrics = BenchmarkMetrics(
        solver_name=run.solver_name,
        total_latency_seconds=run.total_latency_seconds,
    )

    if not run.results:
        return metrics

    # Overall accuracy
    metrics.overall_correct = sum(1 for r in run.results if r.is_correct)
    metrics.overall_total = len(run.results)

    # Average latency
    latencies = [r.latency_seconds for r in run.results]
    metrics.avg_latency_seconds = sum(latencies) / len(latencies)

    # Per-subject accuracy
    subject_stats: dict[str, dict[str, int]] = defaultdict(
        lambda: {"correct": 0, "total": 0}
    )
    for r in run.results:
        subject_stats[r.subject_area]["total"] += 1
        if r.is_correct:
            subject_stats[r.subject_area]["correct"] += 1

    metrics.by_subject = sorted(
        [
            SubjectAccuracy(subject=subj, correct=stats["correct"], total=stats["total"])
            for subj, stats in subject_stats.items()
        ],
        key=lambda x: x.subject,
    )

    return metrics


@dataclass
class ComparisonResult:
    """Side-by-side comparison of two benchmark runs."""

    multi_agent: BenchmarkMetrics
    baseline: BenchmarkMetrics

    @property
    def accuracy_delta(self) -> float:
        """Multi-agent accuracy minus baseline accuracy (positive = multi-agent better)."""
        return self.multi_agent.overall_accuracy - self.baseline.overall_accuracy

    @property
    def latency_ratio(self) -> float:
        """Multi-agent latency / baseline latency."""
        if self.baseline.avg_latency_seconds == 0:
            return 0.0
        return self.multi_agent.avg_latency_seconds / self.baseline.avg_latency_seconds


def compare_runs(
    multi_agent_run: BenchmarkRun,
    baseline_run: BenchmarkRun,
) -> ComparisonResult:
    """Compare multi-agent and baseline benchmark runs.

    Args:
        multi_agent_run: Results from the multi-agent system.
        baseline_run: Results from the single-call baseline.

    Returns:
        ComparisonResult with side-by-side metrics.
    """
    return ComparisonResult(
        multi_agent=compute_metrics(multi_agent_run),
        baseline=compute_metrics(baseline_run),
    )
