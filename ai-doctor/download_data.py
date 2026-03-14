#!/usr/bin/env python3
"""Download and cache benchmark datasets for offline use.

Usage:
    python download_data.py
    python download_data.py --dataset medqa
    python download_data.py --dataset medmcqa
"""

import argparse

from datasets import load_dataset


def download_medqa() -> None:
    """Download and cache MedQA USMLE dataset."""
    print("Downloading MedQA (USMLE 4-options)...")
    ds = load_dataset("GBaker/MedQA-USMLE-4-options")
    for split in ds:
        print(f"  {split}: {len(ds[split])} questions")
    print("MedQA cached successfully.\n")


def download_medmcqa() -> None:
    """Download and cache MedMCQA dataset."""
    print("Downloading MedMCQA...")
    ds = load_dataset("openlifescienceai/medmcqa")
    for split in ds:
        print(f"  {split}: {len(ds[split])} questions")
    print("MedMCQA cached successfully.\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Download benchmark datasets")
    parser.add_argument(
        "--dataset",
        choices=["medqa", "medmcqa", "all"],
        default="all",
        help="Which dataset to download (default: all)",
    )
    args = parser.parse_args()

    if args.dataset in ("medqa", "all"):
        download_medqa()
    if args.dataset in ("medmcqa", "all"):
        download_medmcqa()

    print("Done! Datasets are cached locally by HuggingFace.")


if __name__ == "__main__":
    main()
