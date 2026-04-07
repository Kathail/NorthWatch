import re
from datetime import datetime, timezone

import requests

from app.extensions import db
from app.models import FetchLog, WeatherAlert

WEATHER_API_URL = "https://api.weather.gc.ca/collections/alerts/items"

NORTHERN_ONTARIO_KEYWORDS = [
    "sudbury", "timmins", "sault ste. marie", "north bay",
    "kapuskasing", "cochrane", "parry sound", "manitoulin",
    "espanola", "elliot lake", "kirkland lake", "temiskaming",
    "nipissing", "algoma", "thunder bay", "kenora",
    "rainy river", "hearst", "wawa", "white river",
    "marathon", "geraldton",
]

NORTHERN_RE = re.compile("|".join(NORTHERN_ONTARIO_KEYWORDS), re.IGNORECASE)

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
    records = []
    features = data.get("features", [])

    for feature in features:
        props = feature.get("properties", {})
        title = props.get("headline", props.get("event", ""))
        area = props.get("area", "")

        if not NORTHERN_RE.search(title) and not NORTHERN_RE.search(area):
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

        records.append(
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
