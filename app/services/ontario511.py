from datetime import datetime, timezone

import requests

from app.extensions import db
from app.models import FetchLog, RoadCondition

ONTARIO_511_URL = "https://511on.ca/api/v2/get/roadconditions"
NORTHERN_PREFIXES = ("NER", "NWR")
REGION_MAP = {"NER": "Northeastern", "NWR": "Northwestern"}
HEADERS = {"User-Agent": "NorthWatch/1.0"}


def fetch_road_conditions():
    try:
        response = requests.get(
            ONTARIO_511_URL, headers=HEADERS, timeout=15
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        db.session.add(
            FetchLog(source="ontario511", status="error", error_message=str(e))
        )
        db.session.commit()
        return []

    now = datetime.now(timezone.utc)
    records = []

    for item in data:
        raw_region = item.get("Region", "")
        prefix = raw_region.split(" ")[0] if raw_region else ""
        if prefix not in NORTHERN_PREFIXES:
            continue

        raw_condition = item.get("Condition", "Unknown")
        if isinstance(raw_condition, list):
            raw_condition = ", ".join(raw_condition)

        records.append(
            RoadCondition(
                highway=item.get("RoadwayName", "Unknown").strip(),
                location_description=item.get("LocationDescription", ""),
                condition=raw_condition,
                visibility=item.get("Visibility"),
                drifting=item.get("Drifting"),
                region=REGION_MAP[prefix],
                encoded_polyline=item.get("EncodedPolyline"),
                fetched_at=now,
            )
        )

    if not records:
        db.session.add(
            FetchLog(source="ontario511", status="success", records_count=0)
        )
        db.session.commit()
        return []

    try:
        db.session.query(RoadCondition).delete()
        db.session.bulk_save_objects(records)
        db.session.add(
            FetchLog(source="ontario511", status="success", records_count=len(records))
        )
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        db.session.add(
            FetchLog(source="ontario511", status="error", error_message=str(e))
        )
        db.session.commit()
        return []

    return records
