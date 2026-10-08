"""
app.py — Flask ML microservice for the Smart Street Light Analytics Dashboard.
Runs on port 5001.
"""

import sys
import logging
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS

import data as data_module
import models as models_module
import analytics as analytics_module
import faults as faults_module

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)  # Enable CORS on all routes / all origins

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------
_df = None          # Loaded DataFrame
_models = None      # Dict returned by models_module.train_all
models_loaded = False


def _startup_train():
    """Load CSV and train all models. Called once at startup."""
    global _df, _models, models_loaded
    try:
        _df = data_module.load_csv()
    except FileNotFoundError as exc:
        logger.error("Cannot start: %s", exc)
        sys.exit(1)
    except ValueError as exc:
        logger.warning("Insufficient data at startup: %s", exc)
        models_loaded = False
        return

    try:
        _models = models_module.train_all(_df)
        models_loaded = True
        logger.info("All models trained on %d rows.", len(_df))
    except Exception as exc:
        logger.error("Model training failed: %s", exc)
        models_loaded = False


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------
@app.errorhandler(400)
def bad_request(exc):
    return jsonify({'error': str(exc.description)}), 400


@app.errorhandler(500)
def internal_error(exc):
    return jsonify({'error': 'Internal server error'}), 500


def _models_not_ready():
    return jsonify({'error': 'Models not loaded — insufficient data or training in progress'}), 503


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'models_loaded': models_loaded}), 200


# ---------------------------------------------------------------------------
# Retrain
# ---------------------------------------------------------------------------
@app.route('/retrain', methods=['POST'])
def retrain():
    global _df, _models, models_loaded
    try:
        _df = data_module.load_csv()
    except FileNotFoundError as exc:
        return jsonify({'error': str(exc)}), 500
    except ValueError as exc:
        models_loaded = False
        return jsonify({'error': str(exc)}), 503

    try:
        _models = models_module.train_all(_df)
        models_loaded = True
    except Exception as exc:
        models_loaded = False
        return jsonify({'error': f'Training failed: {exc}'}), 500

    trained_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    return jsonify({'rows_used': len(_df), 'trained_at': trained_at}), 200


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
@app.route('/analytics/summary', methods=['GET'])
def analytics_summary():
    if not models_loaded:
        return _models_not_ready()
    try:
        result = analytics_module.summary_stats(_df)
        return jsonify(result), 200
    except Exception as exc:
        logger.exception("Error in /analytics/summary")
        return jsonify({'error': str(exc)}), 500


@app.route('/analytics/history', methods=['GET'])
def analytics_history():
    if not models_loaded:
        return _models_not_ready()
    try:
        limit = int(request.args.get('limit', 200))
        if limit < 1:
            return jsonify({'error': 'limit must be a positive integer'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'limit must be a positive integer'}), 400

    try:
        rows = analytics_module.get_history(_df, limit=limit)
        return jsonify(rows), 200
    except Exception as exc:
        logger.exception("Error in /analytics/history")
        return jsonify({'error': str(exc)}), 500


@app.route('/analytics/correlation', methods=['GET'])
def analytics_correlation():
    if not models_loaded:
        return _models_not_ready()
    try:
        result = analytics_module.get_correlation(_df)
        return jsonify(result), 200
    except Exception as exc:
        logger.exception("Error in /analytics/correlation")
        return jsonify({'error': str(exc)}), 500


# ---------------------------------------------------------------------------
# Predictions
# ---------------------------------------------------------------------------
@app.route('/predict/led', methods=['POST'])
def predict_led():
    if not models_loaded:
        return _models_not_ready()

    body = request.get_json(silent=True) or {}
    required = ['ldr', 'ir1', 'ir2', 'temp', 'hum']
    features = {}
    for field in required:
        if field not in body:
            return jsonify({'error': f"Missing required field: '{field}'"}), 400
        try:
            features[field] = float(body[field])
        except (ValueError, TypeError):
            return jsonify({'error': f"Field '{field}' must be numeric"}), 400

    try:
        result = _models['led'].predict(features)
        return jsonify(result), 200
    except Exception as exc:
        logger.exception("Error in /predict/led")
        return jsonify({'error': str(exc)}), 500


@app.route('/predict/ldr', methods=['GET'])
def predict_ldr():
    if not models_loaded:
        return _models_not_ready()

    try:
        steps = int(request.args.get('steps', 10))
    except (ValueError, TypeError):
        return jsonify({'error': 'steps must be an integer'}), 400

    if steps < 1 or steps > 60:
        return jsonify({'error': 'steps must be between 1 and 60'}), 400

    try:
        forecast = _models['ldr'].forecast(steps)
        return jsonify({'forecast': forecast}), 200
    except Exception as exc:
        logger.exception("Error in /predict/ldr")
        return jsonify({'error': str(exc)}), 500


@app.route('/predict/temperature', methods=['GET'])
def predict_temperature():
    if not models_loaded:
        return _models_not_ready()

    try:
        steps = int(request.args.get('steps', 10))
    except (ValueError, TypeError):
        return jsonify({'error': 'steps must be an integer'}), 400

    if steps < 1 or steps > 60:
        return jsonify({'error': 'steps must be between 1 and 60'}), 400

    try:
        forecast = _models['temp'].forecast(steps)
        return jsonify({'forecast': forecast}), 200
    except Exception as exc:
        logger.exception("Error in /predict/temperature")
        return jsonify({'error': str(exc)}), 500


# ---------------------------------------------------------------------------
# Faults
# ---------------------------------------------------------------------------
@app.route('/faults/detect', methods=['GET'])
def faults_detect():
    if not models_loaded:
        return _models_not_ready()

    try:
        limit = int(request.args.get('limit', 200))
        if limit < 1:
            return jsonify({'error': 'limit must be a positive integer'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'limit must be a positive integer'}), 400

    try:
        recent = _df.sort_values('timestamp', ascending=True).tail(limit).reset_index(drop=True)
        rows = faults_module.annotate_anomalies(recent, _models['anomaly'])
        return jsonify(rows), 200
    except Exception as exc:
        logger.exception("Error in /faults/detect")
        return jsonify({'error': str(exc)}), 500


@app.route('/faults/detect-single', methods=['POST'])
def faults_detect_single():
    if not models_loaded:
        return _models_not_ready()

    body = request.get_json(silent=True) or {}
    required = ['temp', 'hum', 'ldr', 'ir1', 'ir2']
    features = {}
    for field in required:
        if field not in body:
            return jsonify({'error': f"Missing required field: '{field}'"}), 400
        try:
            features[field] = float(body[field])
        except (ValueError, TypeError):
            return jsonify({'error': f"Field '{field}' must be numeric"}), 400

    try:
        result = _models['anomaly'].predict(features)
        return jsonify(result), 200
    except Exception as exc:
        logger.exception("Error in /faults/detect-single")
        return jsonify({'error': str(exc)}), 500


@app.route('/faults/stuck-sensors', methods=['GET'])
def faults_stuck_sensors():
    if not models_loaded:
        return _models_not_ready()
    try:
        result = faults_module.detect_stuck_sensors(_df)
        return jsonify(result), 200
    except Exception as exc:
        logger.exception("Error in /faults/stuck-sensors")
        return jsonify({'error': str(exc)}), 500


@app.route('/faults/outliers', methods=['GET'])
def faults_outliers():
    if not models_loaded:
        return _models_not_ready()
    try:
        result = faults_module.detect_outliers(_df)
        return jsonify(result), 200
    except Exception as exc:
        logger.exception("Error in /faults/outliers")
        return jsonify({'error': str(exc)}), 500


@app.route('/faults/recommendations', methods=['GET'])
def faults_recommendations():
    if not models_loaded:
        return _models_not_ready()
    try:
        result = faults_module.build_recommendations(_df, _models['anomaly'])
        return jsonify(result), 200
    except Exception as exc:
        logger.exception("Error in /faults/recommendations")
        return jsonify({'error': str(exc)}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    _startup_train()
    app.run(host='0.0.0.0', port=5001, debug=False)
