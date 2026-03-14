"""Dataset loading and normalization for MedQA and MedMCQA benchmarks."""

from dataclasses import dataclass

from datasets import load_dataset


@dataclass
class BenchmarkQuestion:
    """A normalized benchmark question from any supported dataset."""

    question_id: str
    question: str
    options: dict[str, str]  # e.g. {"A": "...", "B": "...", "C": "...", "D": "..."}
    correct_answer: str  # letter key, e.g. "A"
    subject_area: str
    source: str  # "medqa" or "medmcqa"

    def format_for_agent(self) -> str:
        """Format as a clinical MCQ for the agent system."""
        options_text = "\n".join(
            f"  {key}. {value}" for key, value in sorted(self.options.items())
        )
        return f"{self.question}\n\n{options_text}"


def load_medqa(
    split: str = "test",
    num_questions: int | None = None,
) -> list[BenchmarkQuestion]:
    """Load MedQA (USMLE 4-option) dataset from HuggingFace.

    Args:
        split: Dataset split to load ("train", "test", "dev").
        num_questions: Number of questions to load (None = all).

    Returns:
        List of normalized BenchmarkQuestion instances.
    """
    ds = load_dataset("GBaker/MedQA-USMLE-4-options", split=split)

    questions = []
    for i, item in enumerate(ds):
        if num_questions and i >= num_questions:
            break

        # MedQA has options as a dict with keys "A", "B", "C", "D"
        options = item.get("options", {})
        if isinstance(options, dict):
            opts = options
        else:
            # Fallback parsing if format differs
            opts = {chr(65 + j): str(v) for j, v in enumerate(options)}

        answer_idx = item.get("answer_idx", item.get("answer", ""))

        questions.append(
            BenchmarkQuestion(
                question_id=f"medqa_{split}_{i}",
                question=item["question"],
                options=opts,
                correct_answer=str(answer_idx),
                subject_area=item.get("meta_info", "unknown")
                if isinstance(item.get("meta_info"), str)
                else "unknown",
                source="medqa",
            )
        )

    return questions


def load_medmcqa(
    split: str = "validation",
    num_questions: int | None = None,
) -> list[BenchmarkQuestion]:
    """Load MedMCQA dataset from HuggingFace.

    Args:
        split: Dataset split to load ("train", "validation", "test").
            Note: "test" split has no labels, use "validation" for evaluation.
        num_questions: Number of questions to load (None = all).

    Returns:
        List of normalized BenchmarkQuestion instances.
    """
    ds = load_dataset("openlifescienceai/medmcqa", split=split)

    idx_to_letter = {0: "A", 1: "B", 2: "C", 3: "D"}

    questions = []
    for i, item in enumerate(ds):
        if num_questions and i >= num_questions:
            break

        options = {
            "A": item["opa"],
            "B": item["opb"],
            "C": item["opc"],
            "D": item["opd"],
        }

        correct = idx_to_letter.get(item.get("cop", -1), "")

        questions.append(
            BenchmarkQuestion(
                question_id=f"medmcqa_{split}_{i}",
                question=item["question"],
                options=options,
                correct_answer=correct,
                subject_area=item.get("subject_name", "unknown"),
                source="medmcqa",
            )
        )

    return questions


def load_dataset_by_name(
    name: str,
    num_questions: int | None = None,
) -> list[BenchmarkQuestion]:
    """Load a benchmark dataset by name.

    Args:
        name: "medqa" or "medmcqa".
        num_questions: Number of questions to load.

    Returns:
        List of normalized BenchmarkQuestion instances.
    """
    loaders = {
        "medqa": load_medqa,
        "medmcqa": load_medmcqa,
    }
    if name not in loaders:
        raise ValueError(f"Unknown dataset: {name}. Must be one of: {list(loaders)}")
    return loaders[name](num_questions=num_questions)
