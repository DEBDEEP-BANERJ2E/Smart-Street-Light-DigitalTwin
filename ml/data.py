"""
data.py — CSV loading, validation, and feature engineering for the ML service.
"""

import os
import logging
import pandas as pd

logger = logging.getLogger(__name__)

CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'backend', 'data.csv')

REQUIRED_COLUMNS = {'timestamp', 'temp', 'hum', 'ldr', 'ir1', 'ir2'}
NUMERIC_COLUMNS = ['temp', 'hum', 'ldr', 'ir1', 'ir2']


def load_csv(path: str = CSV_PATH) -> pd.DataFrame:
    """
    Load and validate the sensor CSV file.

    - Skips rows where any numeric column is non-numeric or missing.
    - Raises ValueError if fewer than 10 valid rows remain.
    - Raises FileNotFoundError if the file does not exist.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"Data file not found: {path}")

    try:
        df = pd.read_csv(path)
    except Exception as exc:
        raise ValueError(f"Failed to parse CSV: {exc}") from exc

    # Check required columns exist
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")

    # Coerce numeric columns; non-parseable values become NaN
    for col in NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    # Also coerce timestamp
    df['timestamp'] = pd.to_numeric(df['timestamp'], errors='coerce')

    # Count and log skipped rows
    before = len(df)
    df = df.dropna(subset=NUMERIC_COLUMNS + ['timestamp'])
    skipped = before - len(df)
    if skipped:
        logger.warning("Skipped %d malformed row(s) from %s", skipped, path)

    if len(df) < 10:
        raise ValueError(
            f"Insufficient data: only {len(df)} valid row(s) found (minimum 10 required)."
        )

    df = df.reset_index(drop=True)
    return df


def add_led_labels(df: pd.DataFrame) -> pd.DataFrame:
    """
    Derive LED labels from the Digital Twin rule:
        led_on = (ldr < 2000) AND (ir == 0)

    led1 uses ir1, led2 uses ir2.
    Returns a copy of df with 'led1' and 'led2' columns added (int 0/1).
    """
    df = df.copy()
    df['led1'] = ((df['ldr'] < 2000) & (df['ir1'] == 0)).astype(int)
    df['led2'] = ((df['ldr'] < 2000) & (df['ir2'] == 0)).astype(int)
    return df
