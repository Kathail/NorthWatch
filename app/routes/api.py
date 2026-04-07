from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from app.extensions import db
from app.models import FetchLog, PowerOutage, RoadCondition, WeatherAlert

api_bp = Blueprint("api", __name__, url_prefix="/api/v1")

HAZARD_KEYWORDS = ["snow", "ice", "packed", "covered", "closed"]


def _hazard_filter():
    return or_(*[RoadCondition.condition.ilike(f"%{kw}%") for kw in HAZARD_KEYWORDS])


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
    active_outages = PowerOutage.query.filter_by(status="active").all()
    power_outages = 0
    for o in active_outages:
        if o.cause and o.cause[0].isdigit():
            power_outages += int(o.cause.split()[0])
        else:
            power_outages += 1
    customers_affected = (
        db.session.query(db.func.coalesce(db.func.sum(PowerOutage.customers_affected), 0))
        .filter(PowerOutage.status == "active")
        .scalar()
    )
    weather_alerts = db.session.query(db.func.count(WeatherAlert.id)).scalar()

    latest_log = (
        db.session.query(FetchLog.fetched_at)
        .order_by(FetchLog.fetched_at.desc())
        .first()
    )

    return jsonify({
        "road_alerts": road_alerts,
        "power_outages": power_outages,
        "weather_alerts": weather_alerts,
        "highways_clear": highways_clear,
        "customers_affected": customers_affected,
        "last_updated": (
            latest_log.fetched_at.isoformat() + "Z" if latest_log else None
        ),
    })


@api_bp.route("/roads")
def get_roads():
    query = RoadCondition.query
    region = request.args.get("region")
    highway = request.args.get("highway")
    if region:
        query = query.filter(RoadCondition.region.ilike(f"%{region}%"))
    if highway:
        query = query.filter(RoadCondition.highway == highway)
    conditions = query.order_by(RoadCondition.highway.asc()).all()
    return jsonify([c.to_dict() for c in conditions])


@api_bp.route("/outages")
def get_outages():
    query = PowerOutage.query.filter_by(status="active")
    utility = request.args.get("utility")
    if utility:
        query = query.filter(PowerOutage.utility.ilike(f"%{utility}%"))
    outages = query.order_by(
        db.case(
            (PowerOutage.customers_affected.is_(None), 1),
            else_=0,
        ),
        PowerOutage.customers_affected.desc(),
    ).all()
    return jsonify([o.to_dict() for o in outages])


@api_bp.route("/weather")
def get_weather():
    query = WeatherAlert.query
    region = request.args.get("region")
    severity = request.args.get("severity")
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
    return jsonify([a.to_dict() for a in alerts])


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
    import requests as req
    city = request.args.get("city", "Sudbury,Ontario")
    try:
        r = req.get(
            f"https://wttr.in/{city}",
            params={"format": "j1"},
            headers={"User-Agent": "NorthWatch/1.0"},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        cur = data["current_condition"][0]
        return jsonify({
            "temp_c": int(cur["temp_C"]),
            "feels_like_c": int(cur["FeelsLikeC"]),
            "description": cur["weatherDesc"][0]["value"],
            "wind_kmph": int(cur["windspeedKmph"]),
            "humidity": int(cur["humidity"]),
            "city": city.split(",")[0],
        })
    except Exception:
        return jsonify({"error": "unavailable"}), 503


@api_bp.route("/logs")
def get_logs():
    source = request.args.get("source")
    limit = request.args.get("limit", 50, type=int)
    query = FetchLog.query
    if source:
        query = query.filter(FetchLog.source == source)
    logs = query.order_by(FetchLog.fetched_at.desc()).limit(limit).all()
    return jsonify([l.to_dict() for l in logs])
