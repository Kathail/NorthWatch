"""Northern Ontario power outage aggregator.

Sources:
1. Hydro One (Kubra StormCenter) - covers ~90% of Northern Ontario
   Public summary endpoint gives total outage count + customers affected.
   Individual outage locations require Kubra auth (not available).

2. Lakeland Power (Bracebridge, Parry Sound area)
   Custom ASP.NET outage map at outages.lakelandpower.on.ca
   /Home/UpdatePushpin returns XML with individual outage locations.
   Requires session cookie from initial page load.

Not yet available (no public API found):
- Greater Sudbury Hydro (no public outage data)
- North Bay Hydro (phone-only reporting)
- Synergy North / Thunder Bay (no API)
- PUC Services / Sault Ste. Marie (no API)
- Algoma Power (no API)
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

    return [
        {
            "utility": "Hydro One",
            "area": "Northern Ontario service territory",
            "customers_affected": customers,
            "cause": f"{outage_count} active outage{'s' if outage_count != 1 else ''}",
            "estimated_restoration": None,
            "latitude": 46.5,
            "longitude": -81.0,
        }
    ]


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
        lat_el = table.find("Latitude") or table.find("latitude")
        lng_el = table.find("Longitude") or table.find("longitude")
        cust_el = table.find("CustomersAffected") or table.find("customersaffected") or table.find("Customers")
        cause_el = table.find("Cause") or table.find("cause")
        etr_el = table.find("ETOR") or table.find("etor") or table.find("ETR") or table.find("etr")
        area_el = table.find("Area") or table.find("area") or table.find("Municipality") or table.find("municipality")

        lat = float(lat_el.text) if lat_el is not None and lat_el.text else None
        lng = float(lng_el.text) if lng_el is not None and lng_el.text else None
        customers = int(cust_el.text) if cust_el is not None and cust_el.text and cust_el.text.isdigit() else None
        cause = cause_el.text if cause_el is not None else None
        area = area_el.text if area_el is not None and area_el.text else "Lakeland Power service area"

        etr = None
        if etr_el is not None and etr_el.text:
            try:
                etr = datetime.fromisoformat(etr_el.text.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass

        outages.append({
            "utility": "Lakeland Power",
            "area": area,
            "customers_affected": customers,
            "cause": cause,
            "estimated_restoration": etr,
            "latitude": lat,
            "longitude": lng,
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

    db.session.query(PowerOutage).delete()

    records = []
    for o in all_outages:
        record = PowerOutage(
            utility=o["utility"],
            area=o["area"],
            customers_affected=o["customers_affected"],
            cause=o["cause"],
            estimated_restoration=o.get("estimated_restoration"),
            status="active",
            latitude=o["latitude"],
            longitude=o["longitude"],
            fetched_at=now,
        )
        db.session.add(record)
        records.append(record)

    error_msg = "; ".join(errors) if errors else None
    db.session.add(
        FetchLog(
            source="hydroone",
            status="error" if errors and not records else "success",
            records_count=len(records),
            error_message=error_msg,
        )
    )
    db.session.commit()
    return records
