"""Benchmark execution engine for running questions through solvers."""

import asyncio
import time
from dataclasses import dataclass, field
from typing import Callable, Awaitable

from tqdm.asyncio import tqdm

from agents.client import DEFAULT_MODEL
from agents.orchestrator import OrchestratorAgent
from .baseline import baseline_solve
from .loader import BenchmarkQuestion


@dataclass
class BenchmarkResult:
    """Result for a single benchmark question."""

    question_id: str
    predicted_answer: str
    correct_answer: str
    is_correct: bool
    reasoning: str
    latency_seconds: float
    source: str
    subject_area: str


@dataclass
class BenchmarkRun:
    """Complete results from a benchmark run."""

    solver_name: str
    model: str
    dataset: str
    results: list[BenchmarkResult] = field(default_factory=list)
    total_latency_seconds: float = 0.0


async def run_multi_agent(
    questions: list[BenchmarkQuestion],
    model: str = DEFAULT_MODEL,
    batch_size: int = 3,
) -> BenchmarkRun:
    """Run questions through the multi-agent orchestrator.

    Args:
        questions: List of benchmark questions.
        model: Claude model to use.
        batch_size: Number of questions to process concurrently.

    Returns:
        BenchmarkRun with all results.
    """
    orchestrator = OrchestratorAgent(model=model)
    run = BenchmarkRun(
        solver_name="multi-agent",
        model=model,
        dataset=questions[0].source if questions else "unknown",
    )

    start = time.monotonic()

    # Process in batches
    for batch_start in range(0, len(questions), batch_size):
        batch = questions[batch_start : batch_start + batch_size]

        tasks = []
        for q in batch:
            tasks.append(_solve_with_orchestrator(orchestrator, q))

        batch_results = await tqdm.gather(
            *tasks,
            desc=f"Multi-agent [{batch_start+1}-{batch_start+len(batch)}/{len(questions)}]",
        )

        for result in batch_results:
            if result is not None:
                run.results.append(result)

        # Brief pause between batches to smooth rate limiting
        if batch_start + batch_size < len(questions):
            await asyncio.sleep(1.0)

    run.total_latency_seconds = time.monotonic() - start
    return run


async def _solve_with_orchestrator(
    orchestrator: OrchestratorAgent,
    question: BenchmarkQuestion,
) -> BenchmarkResult | None:
    """Solve a single question with the multi-agent orchestrator."""
    try:
        formatted = question.format_for_agent()
        result = await orchestrator.diagnose(formatted)
        return BenchmarkResult(
            question_id=question.question_id,
            predicted_answer=result.best_answer,
            correct_answer=question.correct_answer,
            is_correct=result.best_answer == question.correct_answer,
            reasoning=result.reasoning,
            latency_seconds=result.latency_seconds,
            source=question.source,
            subject_area=question.subject_area,
        )
    except Exception as e:
        print(f"  Error on {question.question_id}: {e}")
        return None


async def run_baseline(
    questions: list[BenchmarkQuestion],
    model: str = DEFAULT_MODEL,
    batch_size: int = 10,
) -> BenchmarkRun:
    """Run questions through the single-call baseline solver.

    Args:
        questions: List of benchmark questions.
        model: Claude model to use.
        batch_size: Number of questions to process concurrently.

    Returns:
        BenchmarkRun with all results.
    """
    run = BenchmarkRun(
        solver_name="baseline",
        model=model,
        dataset=questions[0].source if questions else "unknown",
    )

    start = time.monotonic()

    for batch_start in range(0, len(questions), batch_size):
        batch = questions[batch_start : batch_start + batch_size]

        tasks = []
        for q in batch:
            tasks.append(_solve_with_baseline(q, model))

        batch_results = await tqdm.gather(
            *tasks,
            desc=f"Baseline [{batch_start+1}-{batch_start+len(batch)}/{len(questions)}]",
        )

        for result in batch_results:
            if result is not None:
                run.results.append(result)

        if batch_start + batch_size < len(questions):
            await asyncio.sleep(0.5)

    run.total_latency_seconds = time.monotonic() - start
    return run


async def _solve_with_baseline(
    question: BenchmarkQuestion,
    model: str,
) -> BenchmarkResult | None:
    """Solve a single question with the baseline solver."""
    try:
        formatted = question.format_for_agent()
        result = await baseline_solve(formatted, model=model)
        return BenchmarkResult(
            question_id=question.question_id,
            predicted_answer=result.best_answer,
            correct_answer=question.correct_answer,
            is_correct=result.best_answer == question.correct_answer,
            reasoning=result.reasoning,
            latency_seconds=result.latency_seconds,
            source=question.source,
            subject_area=question.subject_area,
        )
    except Exception as e:
        print(f"  Error on {question.question_id}: {e}")
        return None
