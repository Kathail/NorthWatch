import re
import time

import requests as req
from flask import Blueprint, jsonify, request, make_response
from sqlalchemy import or_

from app.extensions import db
from app.models import FetchLog, PowerOutage, RoadCondition, WeatherAlert

api_bp = Blueprint("api", __name__, url_prefix="/api/v1")

HAZARD_KEYWORDS = ["snow", "ice", "packed", "covered", "closed"]
CITY_RE = re.compile(r"^[A-Za-z\s,\-'.]+$")

_weather_cache = {"data": None, "ts": 0}
WEATHER_CACHE_TTL = 600


def _hazard_filter():
    return or_(*[RoadCondition.condition.ilike(f"%{kw}%") for kw in HAZARD_KEYWORDS])


def _cache_response(resp, max_age=30):
    resp.cache_control.max_age = max_age
    resp.cache_control.public = True
    return resp


@api_bp.route("/status")
def get_status():
    road_alerts = (
        db.session.query(db.func.count(RoadCondition.id))
        .filter(_hazard_filter())
        .scalar()
    )
    highways_clear = (
        db.session.query(db.func.count(RoadCondition.id))
        .filter(~_hazard_filter())
        .scalar()
    )

    outage_rows = (
        db.session.query(PowerOutage.cause, PowerOutage.customers_affected)
        .filter(PowerOutage.status == "active")
        .all()
    )
    power_outages = 0
    customers_affected = 0
    for cause, cust in outage_rows:
        if cause and cause[0].isdigit():
            power_outages += int(cause.split()[0])
        else:
            power_outages += 1
        customers_affected += cust or 0

    weather_alerts = db.session.query(db.func.count(WeatherAlert.id)).scalar()

    latest_log = (
        db.session.query(FetchLog.fetched_at)
        .order_by(FetchLog.fetched_at.desc())
        .first()
    )

    return _cache_response(jsonify({
        "road_alerts": road_alerts,
        "power_outages": power_outages,
        "weather_alerts": weather_alerts,
        "highways_clear": highways_clear,
        "customers_affected": customers_affected,
        "last_updated": (
            latest_log.fetched_at.isoformat() + "Z" if latest_log else None
        ),
    }))


@api_bp.route("/roads")
def get_roads():
    query = RoadCondition.query
    region = (request.args.get("region") or "")[:50]
    highway = (request.args.get("highway") or "")[:20]
    if region:
        query = query.filter(RoadCondition.region.ilike(f"%{region}%"))
    if highway:
        query = query.filter(RoadCondition.highway == highway)
    conditions = query.order_by(RoadCondition.highway.asc()).all()
    return _cache_response(jsonify([c.to_dict() for c in conditions]))


@api_bp.route("/outages")
def get_outages():
    query = PowerOutage.query.filter_by(status="active")
    utility = (request.args.get("utility") or "")[:50]
    if utility:
        query = query.filter(PowerOutage.utility.ilike(f"%{utility}%"))
    outages = query.order_by(
        db.case(
            (PowerOutage.customers_affected.is_(None), 1),
            else_=0,
        ),
        PowerOutage.customers_affected.desc(),
    ).all()
    return _cache_response(jsonify([o.to_dict() for o in outages]))


@api_bp.route("/weather")
def get_weather():
    query = WeatherAlert.query
    region = (request.args.get("region") or "")[:100]
    severity = (request.args.get("severity") or "")[:20]
    if region:
        query = query.filter(WeatherAlert.region.ilike(f"%{region}%"))
    if severity:
        query = query.filter(WeatherAlert.severity == severity)
    severity_order = db.case(
        (WeatherAlert.severity == "red", 0),
        (WeatherAlert.severity == "orange", 1),
        (WeatherAlert.severity == "yellow", 2),
        else_=3,
    )
    alerts = query.order_by(severity_order, WeatherAlert.issued_at.desc()).all()
    return _cache_response(jsonify([a.to_dict() for a in alerts]))


@api_bp.route("/fetch/<source>")
def trigger_fetch(source):
    fetchers = {
        "ontario511": "app.services.ontario511:fetch_road_conditions",
        "weather": "app.services.weather:fetch_weather_alerts",
        "hydroone": "app.services.hydroone:fetch_power_outages",
    }
    if source not in fetchers:
        return jsonify({"error": "Unknown source", "valid": list(fetchers)}), 400
    module_path, func_name = fetchers[source].split(":")
    import importlib
    module = importlib.import_module(module_path)
    getattr(module, func_name)()
    log = (
        FetchLog.query
        .filter_by(source=source)
        .order_by(FetchLog.fetched_at.desc())
        .first()
    )
    return jsonify(log.to_dict() if log else {"source": source, "status": "no log"})


@api_bp.route("/local-weather")
def get_local_weather():
    city = (request.args.get("city") or "Sudbury,Ontario")[:80]
    if not CITY_RE.match(city):
        return jsonify({"error": "invalid city"}), 400

    now = time.time()
    cache_key = city.lower()
    if _weather_cache["data"] and (now - _weather_cache["ts"]) < WEATHER_CACHE_TTL:
        cached = _weather_cache["data"]
        if cached.get("_key") == cache_key:
            return _cache_response(jsonify(cached), max_age=300)

    try:
        r = req.get(
            f"https://wttr.in/{city}",
            params={"format": "j1"},
            headers={"User-Agent": "NorthWatch/1.0"},
            timeout=8,
        )
        r.raise_for_status()
        data = r.json()
        cur = data["current_condition"][0]
        result = {
            "temp_c": int(cur["temp_C"]),
            "feels_like_c": int(cur["FeelsLikeC"]),
            "description": cur["weatherDesc"][0]["value"],
            "wind_kmph": int(cur["windspeedKmph"]),
            "humidity": int(cur["humidity"]),
            "city": city.split(",")[0],
            "_key": cache_key,
        }
        _weather_cache["data"] = result
        _weather_cache["ts"] = now
        return _cache_response(jsonify(result), max_age=300)
    except Exception:
        if _weather_cache["data"] and _weather_cache["data"].get("_key") == cache_key:
            return _cache_response(jsonify(_weather_cache["data"]), max_age=60)
        return jsonify({"error": "unavailable"}), 503


@api_bp.route("/logs")
def get_logs():
    source = (request.args.get("source") or "")[:50]
    limit = request.args.get("limit", 50, type=int)
    limit = min(limit, 200)
    query = FetchLog.query
    if source:
        query = query.filter(FetchLog.source == source)
    logs = query.order_by(FetchLog.fetched_at.desc()).limit(limit).all()
    return jsonify([l.to_dict() for l in logs])
