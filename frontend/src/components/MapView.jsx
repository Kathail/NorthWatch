import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import L from "leaflet";
import { decodePolyline } from "../utils/polyline";

const HAZARD_RE = /snow|ice|packed|covered|closed/i;
const WET_RE = /bare\s+and\s+wet/i;
const MAJOR_THRESHOLD = 200;

function getRoadColor(condition) {
  const c = condition.toLowerCase();
  if (c.includes("closed")) return "#A32D2D";
  if (HAZARD_RE.test(c)) return "#185FA5";
  if (WET_RE.test(c)) return "#2B8A94";
  return "#639922";
}

function isMajorHighway(highway) {
  const num = parseInt(highway);
  return !isNaN(num) && num < MAJOR_THRESHOLD;
}

function isNamedRoad(highway) {
  return !/^\d/.test(highway);
}

function useDarkMode() {
  const [dark, setDark] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return dark;
}

function MapBridge({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

function TileSwapper({ dark }) {
  const map = useMap();
  useEffect(() => {
    const url = dark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    const attr = dark
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer);
    });
    L.tileLayer(url, { attribution: attr, maxZoom: 18 }).addTo(map);
  }, [map, dark]);
  return null;
}

function RoadLines({ roads }) {
  const [zoom, setZoom] = useState(6);
  const map = useMap();
  const polylineCache = useRef(new Map());

  useEffect(() => {
    setZoom(map.getZoom());
  }, [map]);

  useMapEvents({
    zoomend: (e) => setZoom(e.target.getZoom()),
  });

  const decoded = useMemo(() => {
    const cache = polylineCache.current;
    const result = new Map();
    roads.forEach((road) => {
      if (!road.encoded_polyline) return;
      if (cache.has(road.id)) {
        result.set(road.id, cache.get(road.id));
      } else {
        const pts = decodePolyline(road.encoded_polyline);
        cache.set(road.id, pts);
        result.set(road.id, pts);
      }
    });
    return result;
  }, [roads]);

  return roads
    .filter((road) => {
      if (!road.encoded_polyline) return false;
      if (zoom < 8 && !isMajorHighway(road.highway)) return false;
      return true;
    })
    .map((road) => {
      const positions = decoded.get(road.id);
      if (positions.length === 0) return null;
      const named = isNamedRoad(road.highway);
      const minor = !isMajorHighway(road.highway);
      const baseWeight = named ? 2 : minor ? 3 : 4;
      const baseOpacity = named ? 0.4 : minor ? 0.6 : 0.8;
      return (
        <Polyline
          key={road.id}
          positions={positions}
          pathOptions={{
            color: getRoadColor(road.condition),
            weight: baseWeight,
            opacity: baseOpacity,
          }}
          eventHandlers={{
            mouseover: (e) => e.target.setStyle({ weight: baseWeight + 3 }),
            mouseout: (e) => e.target.setStyle({ weight: baseWeight }),
          }}
        >
          <Tooltip sticky direction="top" offset={[0, -8]}>
            Hwy {road.highway}
          </Tooltip>
          <Popup>
            <div className="font-semibold">Hwy {road.highway}</div>
            <div className="mt-1">{road.condition}</div>
            {road.visibility && (
              <div className="text-gray-500">Visibility: {road.visibility}</div>
            )}
            {road.drifting && (
              <div className="text-gray-500">Drifting: {road.drifting}</div>
            )}
            <div className="text-gray-400 text-[11px] mt-1">
              {road.location_description}
            </div>
          </Popup>
        </Polyline>
      );
    })
    .filter(Boolean);
}

function OutageMarkers({ outages }) {
  return outages
    .filter((o) => {
      if (!o.latitude || !o.longitude) return false;
      if (o.cause && /^\d+\s+active/.test(o.cause)) return false;
      return true;
    })
    .map((o) => (
      <CircleMarker
        key={o.id}
        center={[o.latitude, o.longitude]}
        radius={8}
        pathOptions={{
          fillColor: "#A32D2D",
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
        }}
      >
        <Popup>
          <div className="font-semibold">{o.utility}</div>
          <div className="mt-1">{o.area}</div>
          {o.customers_affected != null && (
            <div>{o.customers_affected.toLocaleString()} customers</div>
          )}
          {o.cause && <div className="text-gray-500">{o.cause}</div>}
        </Popup>
      </CircleMarker>
    ));
}

function OutageBanner({ outages, dark }) {
  const aggregate = outages.find(
    (o) => o.cause && /^\d+\s+active/.test(o.cause)
  );
  if (!aggregate) return null;
  const count = parseInt(aggregate.cause);

  return (
    <div
      className={`absolute top-3 left-12 z-[1000] rounded-lg shadow-md text-xs px-3 py-2 flex items-center gap-2 pointer-events-auto ${
        dark
          ? "bg-gray-800/90 text-gray-200 border border-gray-700"
          : "bg-white/90 text-gray-800 border border-nw-border"
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full inline-block"
        style={{ background: "#A32D2D" }}
      />
      <span>
        <span className="font-semibold text-nw-red">{count}</span>{" "}
        Hydro One outage{count !== 1 ? "s" : ""} &middot;{" "}
        {aggregate.customers_affected?.toLocaleString()} customers
      </span>
    </div>
  );
}

function Legend({ dark, hasOutages }) {
  const items = [
    { color: "#185FA5", label: "Snow / Ice", type: "line" },
    { color: "#2B8A94", label: "Wet", type: "line" },
    { color: "#639922", label: "Clear", type: "line" },
    { color: "#A32D2D", label: "Closed", type: "line" },
  ];
  if (hasOutages) {
    items.push({ color: "#A32D2D", label: "Power outage", type: "dot" });
  }

  return (
    <div
      className={`absolute bottom-12 right-2 z-[1000] rounded-lg shadow-md text-[11px] leading-relaxed px-3 py-2 pointer-events-auto ${
        dark ? "bg-gray-800 text-gray-200" : "bg-white text-gray-800"
      }`}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {item.type === "line" ? (
            <span
              className="inline-block w-4 h-1 rounded-sm"
              style={{ background: item.color }}
            />
          ) : (
            <span
              className="inline-block w-2.5 h-2.5 rounded-full border-2 border-white"
              style={{ background: item.color }}
            />
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function MapView({ roads, outages, filters, onMapReady }) {
  const dark = useDarkMode();
  const filteredRoads = useMemo(
    () => (filters.roads ? roads : []),
    [roads, filters.roads]
  );
  const filteredOutages = useMemo(
    () => (filters.power ? outages : []),
    [outages, filters.power]
  );

  const handleMapReady = useCallback(
    (map) => {
      if (onMapReady) onMapReady(map);
    },
    [onMapReady]
  );

  const hasRealOutages = filteredOutages.some(
    (o) => o.latitude && o.longitude && !(o.cause && /^\d+\s+active/.test(o.cause))
  );

  return (
    <div className="relative">
      <MapContainer
        center={[48.5, -81.0]}
        zoom={6}
        className="h-[350px] md:h-[500px] w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileSwapper dark={dark} />
        <MapBridge onReady={handleMapReady} />
        <RoadLines roads={filteredRoads} />
        <OutageMarkers outages={filteredOutages} />
      </MapContainer>
      {filters.power && (
        <OutageBanner outages={outages} dark={dark} />
      )}
      <Legend dark={dark} hasOutages={hasRealOutages} />
    </div>
  );
}
