"""
faults.py — Anomaly annotation, stuck-sensor detection, outlier detection,
            and fault correction recommendations.
"""

import pandas as pd
import numpy as np

NUMERIC_COLS = ['temp', 'hum', 'ldr', 'ir1', 'ir2']
STUCK_THRESHOLD = 10
OUTLIER_SIGMA = 3


def annotate_anomalies(df: pd.DataFrame, model) -> list:
    """
    Annotate each row in df with is_anomaly (bool) and anomaly_score (float).
    Returns a list of dicts (all original columns + is_anomaly + anomaly_score).
    """
    preds, scores = model.predict_batch(df)
    result = df[['timestamp', 'temp', 'hum', 'ldr', 'ir1', 'ir2']].copy()
    result['is_anomaly'] = (preds == -1)
    result['anomaly_score'] = np.round(scores, 6)
    return result.to_dict(orient='records')


def detect_stuck_sensors(df: pd.DataFrame, threshold: int = STUCK_THRESHOLD) -> list:
    """
    Identify channels where the value has not changed across `threshold` or more
    consecutive readings.

    Returns a list of dicts: {channel, consecutive_count, value}.
    """
    results = []
    for col in NUMERIC_COLS:
        series = df[col].values
        max_run = 0
        max_val = None
        current_run = 1
        current_val = series[0] if len(series) > 0 else None

        for i in range(1, len(series)):
            if series[i] == current_val:
                current_run += 1
            else:
                if current_run > max_run:
                    max_run = current_run
                    max_val = current_val
                current_run = 1
                current_val = series[i]

        # Check the last run
        if current_run > max_run:
            max_run = current_run
            max_val = current_val

        if max_run >= threshold:
            results.append({
                'channel': col,
                'consecutive_count': int(max_run),
                'value': float(max_val) if max_val is not None else None,
            })

    return results


def detect_outliers(df: pd.DataFrame, sigma: float = OUTLIER_SIGMA) -> list:
    """
    Return rows where any numeric field exceeds `sigma` standard deviations
    from that channel's mean. Each row includes an `outlier_fields` list.
    """
    means = df[NUMERIC_COLS].mean()
    stds = df[NUMERIC_COLS].std()

    outlier_rows = []
    for _, row in df.iterrows():
        fields = []
        for col in NUMERIC_COLS:
            if stds[col] > 0 and abs(row[col] - means[col]) > sigma * stds[col]:
                fields.append(col)
        if fields:
            record = row[['timestamp', 'temp', 'hum', 'ldr', 'ir1', 'ir2']].to_dict()
            record['outlier_fields'] = fields
            outlier_rows.append(record)

    return outlier_rows


def build_recommendations(df: pd.DataFrame, model) -> list:
    """
    Build actionable fault correction recommendations based on:
    - Persistent anomalies (≥5 consecutive anomalous readings)
    - Stuck sensors
    - Outlier readings
    """
    recommendations = []

    # --- Persistent anomaly detection ---
    preds, _ = model.predict_batch(df)
    anomaly_flags = (preds == -1)

    # Check each channel for 5+ consecutive anomalies (row-level)
    run = 0
    for flag in anomaly_flags:
        if flag:
            run += 1
            if run == 5:
                recommendations.append({
                    'fault_type': 'persistent_anomaly',
                    'affected_channel': 'multi',
                    'description': 'Five or more consecutive anomalous sensor readings detected.',
                    'suggested_action': (
                        'Investigate environmental conditions or sensor hardware. '
                        'Consider restarting the sensor node and retraining the model.'
                    ),
                })
                break
        else:
            run = 0

    # --- Stuck sensor recommendations ---
    stuck = detect_stuck_sensors(df)
    for s in stuck:
        recommendations.append({
            'fault_type': 'stuck_sensor',
            'affected_channel': s['channel'],
            'description': (
                f"{s['channel']} has not changed value across "
                f"{s['consecutive_count']} consecutive readings."
            ),
            'suggested_action': (
                f"Inspect and recalibrate the {s['channel'].upper()} sensor. "
                "Check wiring and sensor placement."
            ),
        })

    # --- Outlier recommendations ---
    outliers = detect_outliers(df)
    if outliers:
        affected = set()
        for o in outliers:
            affected.update(o['outlier_fields'])
        for channel in sorted(affected):
            recommendations.append({
                'fault_type': 'outlier',
                'affected_channel': channel,
                'description': (
                    f"Outlier readings detected on {channel} "
                    f"(values exceeding {OUTLIER_SIGMA}σ from the channel mean)."
                ),
                'suggested_action': (
                    f"Validate {channel} sensor data. Check for electrical interference, "
                    "sensor drift, or environmental anomalies. Apply data filtering if needed."
                ),
            })

    return recommendations
