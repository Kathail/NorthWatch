from datetime import datetime, timezone

from app.extensions import db


class RoadCondition(db.Model):
    __tablename__ = "road_conditions"
    __table_args__ = (
        db.Index("idx_road_region", "region"),
        db.Index("idx_road_highway", "highway"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    highway = db.Column(db.String(100), nullable=False)
    location_description = db.Column(db.Text, nullable=False)
    condition = db.Column(db.String(100), nullable=False)
    visibility = db.Column(db.String(50), nullable=True)
    drifting = db.Column(db.String(50), nullable=True)
    region = db.Column(db.String(50), nullable=False)
    encoded_polyline = db.Column(db.Text, nullable=True)
    fetched_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {
            "id": self.id,
            "highway": self.highway,
            "location_description": self.location_description,
            "condition": self.condition,
            "visibility": self.visibility,
            "drifting": self.drifting,
            "region": self.region,
            "encoded_polyline": self.encoded_polyline,
            "fetched_at": self.fetched_at.isoformat() + "Z",
        }


class PowerOutage(db.Model):
    __tablename__ = "power_outages"
    __table_args__ = (
        db.Index("idx_power_status", "status"),
        db.Index("idx_power_utility", "utility"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    utility = db.Column(db.String(50), nullable=False)
    area = db.Column(db.String(200), nullable=False)
    customers_affected = db.Column(db.Integer, nullable=True)
    cause = db.Column(db.String(200), nullable=True)
    estimated_restoration = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(50), nullable=False, default="active")
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    fetched_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {
            "id": self.id,
            "utility": self.utility,
            "area": self.area,
            "customers_affected": self.customers_affected,
            "cause": self.cause,
            "estimated_restoration": (
                self.estimated_restoration.isoformat() + "Z"
                if self.estimated_restoration
                else None
            ),
            "status": self.status,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "fetched_at": self.fetched_at.isoformat() + "Z",
        }


class WeatherAlert(db.Model):
    __tablename__ = "weather_alerts"
    __table_args__ = (
        db.Index("idx_weather_region", "region"),
        db.Index("idx_weather_severity", "severity"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    region = db.Column(db.String(100), nullable=False)
    alert_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    issued_at = db.Column(db.DateTime, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)
    fetched_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {
            "id": self.id,
            "region": self.region,
            "alert_type": self.alert_type,
            "severity": self.severity,
            "title": self.title,
            "description": self.description,
            "issued_at": self.issued_at.isoformat() + "Z",
            "expires_at": (
                self.expires_at.isoformat() + "Z" if self.expires_at else None
            ),
            "fetched_at": self.fetched_at.isoformat() + "Z",
        }


class FetchLog(db.Model):
    __tablename__ = "fetch_logs"
    __table_args__ = (
        db.Index("idx_fetchlog_source", "source"),
        db.Index("idx_fetchlog_fetched_at", "fetched_at"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    source = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    records_count = db.Column(db.Integer, default=0)
    error_message = db.Column(db.Text, nullable=True)
    fetched_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {
            "id": self.id,
            "source": self.source,
            "status": self.status,
            "records_count": self.records_count,
            "error_message": self.error_message,
            "fetched_at": self.fetched_at.isoformat() + "Z",
        }
