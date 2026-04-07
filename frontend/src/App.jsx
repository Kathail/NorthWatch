import { useState, useRef, useCallback, useEffect } from "react";
import L from "leaflet";
import Header from "./components/Header";
import AboutModal from "./components/AboutModal";
import StatusCards from "./components/StatusCards";
import FilterPills from "./components/FilterPills";
import MapView from "./components/MapView";
import AlertList from "./components/AlertList";
import LocalInfo from "./components/LocalInfo";
import { useNorthWatch } from "./hooks/useNorthWatch";
import { decodePolyline } from "./utils/polyline";

const HAZARD_RE = /snow|ice|packed|covered|closed/i;

function Toast({ message, onDismiss }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-5 left-5 z-[2000] animate-fade-slide-up">
      <div className="bg-nw-dark dark:bg-gray-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2">
        <svg
          className="w-4 h-4 text-nw-blue flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>{message}</span>
        <button
          onClick={onDismiss}
          className="ml-2 opacity-60 hover:opacity-100 text-lg leading-none"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

function FullscreenButton({ active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-3 right-3 z-[1000] bg-white dark:bg-gray-800 border border-nw-border dark:border-gray-600 rounded-lg px-2.5 py-1.5 shadow-md hover:shadow-lg active:scale-90 transition-all flex items-center gap-1.5"
      title={active ? "Exit fullscreen" : "Fullscreen map"}
    >
      {active ? (
        <svg
          className="w-4 h-4 text-gray-600 dark:text-gray-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="4 14 10 14 10 20" />
          <polyline points="20 10 14 10 14 4" />
          <line x1="14" y1="10" x2="21" y2="3" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 text-gray-600 dark:text-gray-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      )}
      <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
        {active ? "Exit" : "Fullscreen"}
      </span>
    </button>
  );
}

export default function App() {
  const {
    status, roads, outages, weather,
    loading, lastUpdated, tick, toast,
    refresh, dismissToast,
  } = useNorthWatch();

  const [filters, setFilters] = useState({
    roads: true,
    power: true,
    weather: true,
  });
  const [mapFull, setMapFull] = useState(false);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [showAbout, setShowAbout] = useState(false);

  const mapRef = useRef(null);
  const alertsRef = useRef(null);

  const allActive = filters.roads && filters.power && filters.weather;

  const counts = {
    roads: new Set(
      roads
        .filter((r) => HAZARD_RE.test(r.condition))
        .map((r) => r.highway)
    ).size,
    power: status?.power_outages ?? outages.length,
    weather: weather.length,
  };

  function toggleFilter(key) {
    setFilters((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (next.roads && next.power && next.weather) setActiveNav("dashboard");
      return next;
    });
  }

  function resetFilters() {
    setFilters({ roads: true, power: true, weather: true });
    setActiveNav("dashboard");
  }

  function soloFilter(category) {
    const newFilters = { roads: false, power: false, weather: false };
    newFilters[category] = true;
    setFilters(newFilters);
    setActiveNav(category);
    alertsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleCardClick(category) {
    soloFilter(category);
  }

  function handleNav(key) {
    if (key === "about") {
      setShowAbout(true);
      return;
    }
    if (key === "dashboard") {
      resetFilters();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    soloFilter(key);
  }

  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  function handleAlertClick(target) {
    const map = mapRef.current;
    if (!map) return;

    if (target.type === "road") {
      const segments = roads.filter((r) => r.highway === target.highway);
      const allPoints = [];
      segments.forEach((s) => {
        if (s.encoded_polyline) {
          allPoints.push(...decodePolyline(s.encoded_polyline));
        }
      });
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
      }
    } else if (target.type === "outage" && target.lat && target.lng) {
      map.flyTo([target.lat, target.lng], 10, { duration: 0.8 });
    }
  }

  function toggleFullscreen() {
    setMapFull((v) => !v);
    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }

  useEffect(() => {
    if (!mapFull) return;
    function onKey(e) {
      if (e.key === "Escape") {
        setMapFull(false);
        setTimeout(() => mapRef.current?.invalidateSize(), 100);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mapFull]);

  return (
    <div className="min-h-screen bg-nw-bg dark:bg-[#121212]">
      <Header activeNav={activeNav} onNav={handleNav} />
      <LocalInfo />
      <main className="max-w-6xl mx-auto p-4">
        <StatusCards status={status} onCardClick={handleCardClick} />

        <div
          className={`bg-white border border-nw-border rounded-xl overflow-hidden dark:bg-gray-900 dark:border-gray-700 transition-all ${
            mapFull
              ? "fixed inset-0 z-[1500] rounded-none border-0"
              : "mb-4 relative"
          }`}
        >
          {!mapFull && (
            <FilterPills
              filters={filters}
              onToggle={toggleFilter}
              onReset={resetFilters}
              lastUpdated={lastUpdated}
              tick={tick}
              counts={counts}
              onRefresh={refresh}
            />
          )}
          <div className="relative">
            {loading ? (
              <div
                className={`w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 animate-pulse ${
                  mapFull ? "h-screen" : "h-[350px] md:h-[500px]"
                }`}
              >
                <span className="text-gray-400 dark:text-gray-500 text-sm">
                  Loading map...
                </span>
              </div>
            ) : (
              <>
                <div className={mapFull ? "map-fullscreen" : ""}>
                  <MapView
                    roads={roads}
                    outages={outages}
                    filters={filters}
                    onMapReady={handleMapReady}
                  />
                </div>
                <FullscreenButton active={mapFull} onClick={toggleFullscreen} />
              </>
            )}
          </div>
        </div>

        {!mapFull && (
          <div ref={alertsRef}>
            {loading ? (
              <div className="mt-4 flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="bg-white border border-nw-border rounded-lg p-3 h-16 animate-pulse dark:bg-gray-900 dark:border-gray-700"
                  />
                ))}
              </div>
            ) : (
              <AlertList
                roads={roads}
                outages={outages}
                weather={weather}
                filters={filters}
                tick={tick}
                onAlertClick={handleAlertClick}
              />
            )}
          </div>
        )}
      </main>

      {toast && <Toast message={toast} onDismiss={dismissToast} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}
