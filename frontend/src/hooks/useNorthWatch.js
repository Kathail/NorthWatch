import { useState, useEffect, useRef, useCallback } from "react";

const REFRESH_INTERVAL = 120000;
const TICK_INTERVAL = 60000;

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export function useNorthWatch() {
  const [status, setStatus] = useState(null);
  const [roads, setRoads] = useState([]);
  const [outages, setOutages] = useState([]);
  const [weather, setWeather] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState(null);
  const prev = useRef({ status: null, roads: [], outages: [], weather: [] });
  const hasLoaded = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [s, r, o, w] = await Promise.all([
        fetchJSON("/api/v1/status"),
        fetchJSON("/api/v1/roads"),
        fetchJSON("/api/v1/outages"),
        fetchJSON("/api/v1/weather"),
      ]);

      if (hasLoaded.current && prev.current.status) {
        const ps = prev.current.status;
        const changes = [];
        if (s.road_alerts > ps.road_alerts)
          changes.push(`${s.road_alerts - ps.road_alerts} new road alert${s.road_alerts - ps.road_alerts > 1 ? "s" : ""}`);
        if (s.power_outages > ps.power_outages)
          changes.push(`${s.power_outages - ps.power_outages} new outage${s.power_outages - ps.power_outages > 1 ? "s" : ""}`);
        if (s.weather_alerts > ps.weather_alerts)
          changes.push(`${s.weather_alerts - ps.weather_alerts} new weather alert${s.weather_alerts - ps.weather_alerts > 1 ? "s" : ""}`);
        if (changes.length > 0) setToast(changes.join(", "));
      }

      setStatus(s);
      setRoads(r);
      setOutages(o);
      setWeather(w);
      setLastUpdated(s.last_updated);
      prev.current = { status: s, roads: r, outages: o, weather: w };
      hasLoaded.current = true;
    } catch {
      setStatus(prev.current.status);
      setRoads(prev.current.roads);
      setOutages(prev.current.outages);
      setWeather(prev.current.weather);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  return {
    status, roads, outages, weather,
    loading, lastUpdated, tick, toast,
    refresh, dismissToast,
  };
}
