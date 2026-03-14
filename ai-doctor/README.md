# Multi-Agent AI Doctor

A multi-agent clinical reasoning system where 10 organ-system specialist AI agents collaborate through an orchestrator to diagnose clinical cases. Includes a benchmarking pipeline to compare against a single-call baseline on MedQA (USMLE) and MedMCQA datasets.

## Architecture

```
Clinical Case → 10 Specialist Agents (parallel) → Orchestrator → Diagnosis
```

**Specialists** (10 organ-system agents):
- Cardiology, Pulmonology, Nephrology, Neurology
- Gastroenterology, Endocrinology, Hematology/Oncology
- Musculoskeletal/Rheumatology, Infectious Disease, Dermatology

Each specialist analyzes the case from their domain perspective, producing structured output with findings, differential diagnoses, recommended workup, and critical flags.

The **Orchestrator** receives all specialist analyses, weighs them by domain relevance, identifies convergence/divergence, and synthesizes a unified diagnosis.

## Setup

```bash
cd ai-doctor
python -m venv .venv
source .venv/bin/activate
pip install -e .
export ANTHROPIC_API_KEY=sk-...
```

## Usage

### Run a single clinical case

```bash
python run_case.py "A 55-year-old male presents with crushing substernal chest pain..."
```

Or pipe from stdin:
```bash
echo "Clinical case text here" | python run_case.py
```

### Run benchmarks

Download datasets first:
```bash
python download_data.py
```

Run a benchmark comparison:
```bash
# Quick test (10 questions)
python run_benchmark.py --dataset medqa --num-questions 10

# Full run with output
python run_benchmark.py --dataset medqa --num-questions 500 --output results/medqa_500.json

# Use a specific model
python run_benchmark.py --dataset medmcqa --num-questions 100 --model claude-sonnet-4-20250514
```

### CLI Options

| Flag | Default | Description |
|---|---|---|
| `--dataset` | `medqa` | Dataset: `medqa` or `medmcqa` |
| `--num-questions` | `10` | Number of questions to evaluate |
| `--model` | `claude-sonnet-4-20250514` | Claude model to use |
| `--batch-size` | `3` | Concurrent questions (multi-agent) |
| `--baseline-batch-size` | `10` | Concurrent questions (baseline) |
| `--output` | None | Output JSON file path |

## Project Structure

```
ai-doctor/
├── prompts/           # System prompts (one .md per specialist)
├── agents/
│   ├── client.py      # Anthropic client, rate limiting, retry
│   ├── specialist.py  # SpecialistAgent class
│   └── orchestrator.py # OrchestratorAgent (parallel dispatch + synthesis)
├── benchmarks/
│   ├── loader.py      # MedQA/MedMCQA dataset loading
│   ├── baseline.py    # Single-call baseline solver
│   ├── runner.py      # Benchmark execution engine
│   ├── metrics.py     # Accuracy calculations
│   └── reporter.py    # Console tables, JSON, CSV output
├── run_case.py        # Interactive single-case runner
├── run_benchmark.py   # Main benchmark CLI
└── download_data.py   # Dataset download script
```

## Rate Limiting

Three-layer approach to avoid API rate limit errors:
1. **Semaphore**: Caps concurrent API calls to 8
2. **Retry**: Exponential backoff on 429 errors (up to 5 attempts)
3. **Batch pacing**: Brief pauses between question batches
