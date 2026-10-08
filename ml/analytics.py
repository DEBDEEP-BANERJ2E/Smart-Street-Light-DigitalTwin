"""
analytics.py — Summary statistics, history slicing, and correlation helpers.
"""

import pandas as pd

NUMERIC_COLS = ['temp', 'hum', 'ldr', 'ir1', 'ir2']


def summary_stats(df: pd.DataFrame) -> dict:
    """
    Return min, max, mean, and std for each numeric sensor channel.
    """
    result = {}
    for col in NUMERIC_COLS:
        series = df[col]
        result[col] = {
            'min': round(float(series.min()), 6),
            'max': round(float(series.max()), 6),
            'mean': round(float(series.mean()), 6),
            'std': round(float(series.std()), 6),
        }
    return result


def get_history(df: pd.DataFrame, limit: int = 200) -> list:
    """
    Return the most recent `limit` rows sorted ascending by timestamp.
    """
    sorted_df = df.sort_values('timestamp', ascending=True)
    sliced = sorted_df.tail(limit).reset_index(drop=True)
    return sliced[['timestamp', 'temp', 'hum', 'ldr', 'ir1', 'ir2']].to_dict(orient='records')


def get_correlation(df: pd.DataFrame) -> dict:
    """
    Return Pearson correlation coefficients between all pairs of numeric columns.
    Keys are formatted as "col1_col2" (lower-triangle pairs only).
    """
    corr = df[NUMERIC_COLS].corr(method='pearson')
    result = {}
    for i, col1 in enumerate(NUMERIC_COLS):
        for col2 in NUMERIC_COLS[i + 1:]:
            key = f"{col1}_{col2}"
            val = corr.loc[col1, col2]
            result[key] = round(float(val), 6) if pd.notna(val) else None
    return result
