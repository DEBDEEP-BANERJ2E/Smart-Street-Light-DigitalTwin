"""
models.py — Train and expose inference wrappers for all four ML models.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.linear_model import LinearRegression

from data import add_led_labels

FEATURE_COLS = ['ldr', 'ir1', 'ir2', 'temp', 'hum']
ANOMALY_COLS = ['temp', 'hum', 'ldr', 'ir1', 'ir2']


class LEDClassifier:
    """Random Forest classifier predicting led1 and led2 states."""

    def __init__(self):
        self._clf1 = RandomForestClassifier(n_estimators=100, random_state=42)
        self._clf2 = RandomForestClassifier(n_estimators=100, random_state=42)

    def train(self, df: pd.DataFrame) -> None:
        df = add_led_labels(df)
        X = df[FEATURE_COLS].values
        self._clf1.fit(X, df['led1'].values)
        self._clf2.fit(X, df['led2'].values)

    def predict(self, features: dict) -> dict:
        """
        features: dict with keys ldr, ir1, ir2, temp, hum (numeric).
        Returns dict with led1_prediction, led2_prediction, confidence.
        """
        X = np.array([[features['ldr'], features['ir1'], features['ir2'],
                       features['temp'], features['hum']]])
        pred1 = int(self._clf1.predict(X)[0])
        pred2 = int(self._clf2.predict(X)[0])
        # Confidence: mean of max class probability across both classifiers
        prob1 = float(np.max(self._clf1.predict_proba(X)[0]))
        prob2 = float(np.max(self._clf2.predict_proba(X)[0]))
        confidence = round((prob1 + prob2) / 2, 4)
        return {
            'led1_prediction': pred1,
            'led2_prediction': pred2,
            'confidence': confidence,
        }


class LDRForecaster:
    """Linear Regression forecaster for LDR values over time index."""

    def __init__(self):
        self._model = LinearRegression()
        self._n = 0

    def train(self, df: pd.DataFrame) -> None:
        self._n = len(df)
        X = np.arange(self._n).reshape(-1, 1)
        y = df['ldr'].values
        self._model.fit(X, y)

    def forecast(self, steps: int) -> list:
        """Return list of {step, value} dicts for the next `steps` time steps."""
        indices = np.arange(self._n, self._n + steps).reshape(-1, 1)
        values = self._model.predict(indices)
        return [{'step': i + 1, 'value': round(float(v), 4)} for i, v in enumerate(values)]


class TempForecaster:
    """Linear Regression forecaster for temperature values over time index."""

    def __init__(self):
        self._model = LinearRegression()
        self._n = 0

    def train(self, df: pd.DataFrame) -> None:
        self._n = len(df)
        X = np.arange(self._n).reshape(-1, 1)
        y = df['temp'].values
        self._model.fit(X, y)

    def forecast(self, steps: int) -> list:
        """Return list of {step, value} dicts for the next `steps` time steps."""
        indices = np.arange(self._n, self._n + steps).reshape(-1, 1)
        values = self._model.predict(indices)
        return [{'step': i + 1, 'value': round(float(v), 4)} for i, v in enumerate(values)]


class AnomalyDetector:
    """Isolation Forest anomaly detector on sensor features."""

    def __init__(self):
        self._model = IsolationForest(contamination=0.05, random_state=42)

    def train(self, df: pd.DataFrame) -> None:
        X = df[ANOMALY_COLS].values
        self._model.fit(X)

    def predict(self, features: dict) -> dict:
        """
        features: dict with keys temp, hum, ldr, ir1, ir2.
        Returns dict with is_anomaly (bool) and anomaly_score (float).
        """
        X = np.array([[features['temp'], features['hum'], features['ldr'],
                       features['ir1'], features['ir2']]])
        pred = self._model.predict(X)[0]   # 1 = normal, -1 = anomaly
        score = float(self._model.score_samples(X)[0])
        return {
            'is_anomaly': bool(pred == -1),
            'anomaly_score': round(score, 6),
        }

    def predict_batch(self, df: pd.DataFrame) -> tuple:
        """
        Returns (predictions array, scores array) for a DataFrame.
        predictions: 1 = normal, -1 = anomaly
        """
        X = df[ANOMALY_COLS].values
        preds = self._model.predict(X)
        scores = self._model.score_samples(X)
        return preds, scores


def train_all(df: pd.DataFrame) -> dict:
    """
    Train all four models on the given DataFrame.
    Returns a dict with keys: led, ldr, temp, anomaly.
    """
    led = LEDClassifier()
    led.train(df)

    ldr = LDRForecaster()
    ldr.train(df)

    temp = TempForecaster()
    temp.train(df)

    anomaly = AnomalyDetector()
    anomaly.train(df)

    return {'led': led, 'ldr': ldr, 'temp': temp, 'anomaly': anomaly}
