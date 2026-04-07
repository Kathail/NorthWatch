from datetime import datetime, timezone

import requests

from app.extensions import db
from app.models import FetchLog, WeatherAlert

WEATHER_API_URL = "https://api.weather.gc.ca/collections/alerts/items"

NORTHERN_ONTARIO_KEYWORDS = [
    "Sudbury", "Timmins", "Sault Ste. Marie", "North Bay",
    "Kapuskasing", "Cochrane", "Parry Sound", "Manitoulin",
    "Espanola", "Elliot Lake", "Kirkland Lake", "Temiskaming",
    "Nipissing", "Algoma", "Thunder Bay", "Kenora",
    "Rainy River", "Hearst", "Wawa", "White River",
    "Marathon", "Geraldton",
]

SEVERITY_MAP = {
    "Extreme": "red",
    "Severe": "red",
    "Moderate": "orange",
    "Minor": "yellow",
}


def parse_datetime(dt_string):
    if not dt_string:
        return None
    try:
        return datetime.fromisoformat(dt_string.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def is_northern_ontario(text):
    text_lower = text.lower()
    return any(kw.lower() in text_lower for kw in NORTHERN_ONTARIO_KEYWORDS)


def fetch_weather_alerts():
    try:
        params = {
            "lang": "en",
            "type": "warning",
            "sortby": "-datetime",
            "f": "json",
            "limit": 500,
        }
        response = requests.get(WEATHER_API_URL, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        db.session.add(
            FetchLog(source="weather", status="error", error_message=str(e))
        )
        db.session.commit()
        return []

    now = datetime.now(timezone.utc)
    alerts = []
    features = data.get("features", [])

    for feature in features:
        props = feature.get("properties", {})
        title = props.get("headline", props.get("event", ""))
        area = props.get("area", "")

        if not is_northern_ontario(title) and not is_northern_ontario(area):
            continue

        alert_type_raw = props.get("type", "alert").lower()
        if "warning" in alert_type_raw:
            alert_type = "warning"
        elif "watch" in alert_type_raw:
            alert_type = "watch"
        elif "advisory" in alert_type_raw:
            alert_type = "advisory"
        else:
            alert_type = "warning"

        severity_raw = props.get("severity", "Minor")
        severity = SEVERITY_MAP.get(severity_raw, "yellow")

        issued_at = parse_datetime(
            props.get("effective", props.get("sent", ""))
        )
        if not issued_at:
            issued_at = now

        alerts.append(
            WeatherAlert(
                region=area or title,
                alert_type=alert_type,
                severity=severity,
                title=title or props.get("event", "Weather Alert"),
                description=props.get("description"),
                issued_at=issued_at,
                expires_at=parse_datetime(props.get("expires", "")),
                fetched_at=now,
            )
        )

    db.session.query(WeatherAlert).delete()
    for record in alerts:
        db.session.add(record)
    db.session.add(
        FetchLog(source="weather", status="success", records_count=len(alerts))
    )
    db.session.commit()

    return alerts
