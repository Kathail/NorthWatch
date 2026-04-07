"""Northern Ontario power outage aggregator.

Sources:
1. Hydro One (Kubra StormCenter) - covers ~90% of Northern Ontario
2. Lakeland Power (Bracebridge, Parry Sound area)
"""

import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import requests

from app.extensions import db
from app.models import FetchLog, PowerOutage

HEADERS = {"User-Agent": "NorthWatch/1.0"}

KUBRA_HOST = "https://kubra.io"
KUBRA_INSTANCE = "b8d8094c-3809-49e5-bf8b-1ddd27f6e12d"
KUBRA_VIEW = "5c2283d7-eff9-4f7e-966b-3afd90d8a6b9"
KUBRA_STATE_URL = (
    f"{KUBRA_HOST}/stormcenter/api/v1/stormcenters/{KUBRA_INSTANCE}"
    f"/views/{KUBRA_VIEW}/currentState"
)

LAKELAND_BASE = "https://outages.lakelandpower.on.ca"


def fetch_hydro_one():
    response = requests.get(KUBRA_STATE_URL, headers=HEADERS, timeout=15)
    response.raise_for_status()
    state = response.json()
    data_path = state.get("data", {}).get("interval_generation_data", "")
    gen_id = data_path.split("/")[-1] if "/" in data_path else data_path

    url = f"{KUBRA_HOST}/data/{gen_id}/public/summary-1/data.json"
    response = requests.get(url, headers=HEADERS, timeout=15)
    response.raise_for_status()
    summary = response.json()

    totals = summary.get("summaryFileData", {}).get("totals", [])
    if not totals:
        return []

    total = totals[0]
    outage_count = total.get("total_outages", 0)
    customers = total.get("total_cust_a", {}).get("val", 0)

    if outage_count == 0:
        return []

    return [{
        "utility": "Hydro One",
        "area": "Northern Ontario service territory",
        "customers_affected": customers,
        "cause": f"{outage_count} active outage{'s' if outage_count != 1 else ''}",
        "estimated_restoration": None,
        "latitude": 46.5,
        "longitude": -81.0,
    }]


def fetch_lakeland():
    session = requests.Session()
    session.headers.update(HEADERS)
    session.get(LAKELAND_BASE, timeout=10)

    response = session.post(
        f"{LAKELAND_BASE}/Home/UpdatePushpin",
        headers={"Content-Length": "0", "Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )
    response.raise_for_status()

    body = response.text.strip()
    if not body or body == "<NewDataSet />":
        return []

    root = ET.fromstring(body)
    outages = []

    for table in root.findall(".//Table") + root.findall(".//table"):
        def text(tag):
            for name in [tag, tag.lower(), tag.capitalize()]:
                el = table.find(name)
                if el is not None and el.text:
                    return el.text
            return None

        lat_s = text("Latitude")
        lng_s = text("Longitude")
        cust_s = text("CustomersAffected") or text("Customers")
        etr_s = text("ETOR") or text("ETR")

        etr = None
        if etr_s:
            try:
                etr = datetime.fromisoformat(etr_s.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass

        outages.append({
            "utility": "Lakeland Power",
            "area": text("Area") or text("Municipality") or "Lakeland Power service area",
            "customers_affected": int(cust_s) if cust_s and cust_s.isdigit() else None,
            "cause": text("Cause"),
            "estimated_restoration": etr,
            "latitude": float(lat_s) if lat_s else None,
            "longitude": float(lng_s) if lng_s else None,
        })

    return outages


def fetch_power_outages():
    now = datetime.now(timezone.utc)
    all_outages = []
    errors = []

    for name, fetcher in [("Hydro One", fetch_hydro_one), ("Lakeland Power", fetch_lakeland)]:
        try:
            all_outages.extend(fetcher())
        except Exception as e:
            errors.append(f"{name}: {e}")

    try:
        db.session.query(PowerOutage).delete()
        for o in all_outages:
            db.session.add(PowerOutage(
                utility=o["utility"],
                area=o["area"],
                customers_affected=o["customers_affected"],
                cause=o["cause"],
                estimated_restoration=o.get("estimated_restoration"),
                status="active",
                latitude=o["latitude"],
                longitude=o["longitude"],
                fetched_at=now,
            ))
        db.session.add(FetchLog(
            source="hydroone",
            status="error" if errors and not all_outages else "success",
            records_count=len(all_outages),
            error_message="; ".join(errors) if errors else None,
        ))
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        db.session.add(FetchLog(source="hydroone", status="error", error_message=str(e)))
        db.session.commit()

    return all_outages
