import re
from datetime import datetime, timezone

import requests

from app.extensions import db
from app.models import FetchLog, WeatherAlert

WEATHER_API_URL = "https://api.weather.gc.ca/collections/weather-alerts/items"

NORTHERN_ONTARIO_KEYWORDS = [
    "sudbury", "timmins", "sault ste. marie", "north bay",
    "kapuskasing", "cochrane", "parry sound", "manitoulin",
    "espanola", "elliot lake", "kirkland lake", "temiskaming",
    "nipissing", "algoma", "thunder bay", "kenora",
    "rainy river", "hearst", "wawa", "white river",
    "marathon", "geraldton", "muskoka", "haliburton",
]

NORTHERN_RE = re.compile("|".join(NORTHERN_ONTARIO_KEYWORDS), re.IGNORECASE)

ALERT_TYPE_MAP = {
    "warning": "warning",
    "watch": "watch",
    "advisory": "advisory",
    "statement": "advisory",
    "ended": "advisory",
}

SEVERITY_BY_TYPE = {
    "warning": "red",
    "watch": "orange",
    "advisory": "yellow",
    "statement": "yellow",
}


def parse_datetime(dt_string):
    if not dt_string:
        return None
    try:
        return datetime.fromisoformat(dt_string.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def fetch_weather_alerts():
    try:
        params = {
            "lang": "en",
            "f": "json",
            "limit": 500,
            "province": "ON",
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
    records = []
    features = data.get("features", [])

    for feature in features:
        props = feature.get("properties", {})

        feature_name = props.get("feature_name_en", "")
        alert_name = props.get("alert_name_en", "")

        if not NORTHERN_RE.search(feature_name) and not NORTHERN_RE.search(alert_name):
            continue

        raw_type = props.get("alert_type", "warning").lower()
        alert_type = ALERT_TYPE_MAP.get(raw_type, "warning")
        severity = SEVERITY_BY_TYPE.get(raw_type, "yellow")

        issued_at = parse_datetime(props.get("publication_datetime") or props.get("validity_datetime"))
        if not issued_at:
            issued_at = now

        expires_at = parse_datetime(props.get("expiration_datetime") or props.get("event_end_datetime"))

        title = props.get("alert_short_name_en") or props.get("alert_name_en") or "Weather Alert"
        description = props.get("alert_text_en")
        if description and len(description) > 2000:
            description = description[:2000]

        records.append(
            WeatherAlert(
                region=feature_name or "Ontario",
                alert_type=alert_type,
                severity=severity,
                title=title,
                description=description,
                issued_at=issued_at,
                expires_at=expires_at,
                fetched_at=now,
            )
        )

    try:
        db.session.query(WeatherAlert).delete()
        db.session.bulk_save_objects(records)
        db.session.add(
            FetchLog(source="weather", status="success", records_count=len(records))
        )
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        db.session.add(
            FetchLog(source="weather", status="error", error_message=str(e))
        )
        db.session.commit()
        return []

    return records
