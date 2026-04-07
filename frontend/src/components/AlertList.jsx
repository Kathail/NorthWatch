import { useMemo, useState } from "react";

const HAZARD_RE = /snow|ice|packed|covered|closed/i;
const MAJOR_THRESHOLD = 200;
const PAGE_SIZE = 20;

const BADGE_STYLES = {
  road: "bg-blue-50 text-nw-blue dark:bg-blue-950",
  power: "bg-red-50 text-nw-red dark:bg-red-950",
  weather: "bg-amber-50 text-nw-amber dark:bg-amber-950",
};

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Math.floor(
    (Date.now() - new Date(isoString).getTime()) / 60000
  );
  if (diff < 1) return "just now";
  if (diff === 1) return "1 min ago";
  if (diff < 60) return `${diff} min ago`;
  const hours = Math.floor(diff / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

function getConditionLabel(condition) {
  const c = condition.toLowerCase();
  if (c.includes("closed")) return "Closed";
  if (c.includes("ice covered") || c.includes("ice")) return "Icy";
  if (c.includes("snow packed")) return "Packed snow";
  if (c.includes("snow covered")) return "Snow covered";
  if (c.includes("snow")) return "Snowy";
  if (c.includes("wet")) return "Wet";
  return "Varies";
}

function getWorstLabel(conditions) {
  const priority = ["Closed", "Icy", "Packed snow", "Snow covered", "Snowy", "Wet", "Varies"];
  const labels = conditions.map(getConditionLabel);
  for (const p of priority) {
    if (labels.includes(p)) return p;
  }
  return labels[0];
}

function isMajorHighway(highway) {
  const num = parseInt(highway);
  return !isNaN(num) && num < MAJOR_THRESHOLD;
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function SegmentDetail({ segments }) {
  return (
    <div className="mt-2 ml-9 space-y-1.5 border-t border-nw-border dark:border-gray-700 pt-2">
      {segments.map((seg) => (
        <div key={seg.id} className="text-xs flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="text-gray-700 dark:text-gray-300 font-medium min-w-0">
            {seg.location_description}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {getConditionLabel(seg.condition)}
          </span>
          {seg.visibility && seg.visibility !== "Good" && (
            <span className="text-nw-amber">Vis: {seg.visibility}</span>
          )}
          {seg.drifting && seg.drifting !== "No" && seg.drifting !== "None" && (
            <span className="text-nw-amber">Drift: {seg.drifting}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function RoadCard({ item, expanded, onToggle, onFlyTo, delay }) {
  const major = isMajorHighway(item.highway);

  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className={`bg-white border border-nw-border rounded-lg dark:bg-gray-900 dark:border-gray-700 animate-fade-slide-up overflow-hidden ${
        item.closed ? "border-l-[3px] border-l-nw-red" : "border-l-[3px] border-l-nw-blue"
      }`}
    >
      <div
        onClick={() => onToggle(item.highway)}
        className="p-3 flex items-start gap-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 active:scale-[0.995] transition-all"
      >
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 ${BADGE_STYLES.road}`}>
          Road
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`font-medium ${major ? "text-sm" : "text-xs text-gray-600 dark:text-gray-400"} dark:text-white`}>
              Hwy {item.highway}
            </span>
            {major && item.segmentCount > 1 && (
              <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">
                {item.segmentCount}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {item.label} &mdash; {item.segmentCount} section{item.segmentCount > 1 ? "s" : ""}
          </div>
        </div>
        <div className="flex items-center gap-1 mt-1">
          {onFlyTo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFlyTo({ type: "road", highway: item.highway });
              }}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-90 transition-all"
              title="Show on map"
            >
              <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </button>
          )}
          <ChevronIcon open={expanded} />
        </div>
      </div>
      {expanded && <SegmentDetail segments={item.segments} />}
    </div>
  );
}

function AlertCard({ item, delay, onFlyTo }) {
  const clickable = item.type === "power" && item.lat && item.lng;

  return (
    <div
      onClick={() => clickable && onFlyTo?.({ type: "outage", lat: item.lat, lng: item.lng })}
      style={{ animationDelay: `${delay}ms` }}
      className={`bg-white border border-nw-border rounded-lg p-3 flex items-start gap-2.5 dark:bg-gray-900 dark:border-gray-700 animate-fade-slide-up ${item.stripe} ${
        clickable ? "cursor-pointer hover:shadow-sm active:scale-[0.995] transition-all" : ""
      }`}
    >
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 ${BADGE_STYLES[item.type]}`}>
        {item.badge}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm dark:text-white">{item.title}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
          {item.detail}
        </div>
        <div className="text-xs text-gray-400 mt-0.5 dark:text-gray-500">
          {timeAgo(item.time)}
        </div>
      </div>
    </div>
  );
}

export default function AlertList({
  roads,
  outages,
  weather,
  filters,
  tick,
  onAlertClick,
}) {
  void tick;
  const [expanded, setExpanded] = useState(new Set());
  const [showMinor, setShowMinor] = useState(false);
  const [minorCount, setMinorCount] = useState(PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  function toggleExpand(highway) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(highway)) next.delete(highway);
      else next.add(highway);
      return next;
    });
  }

  const { majorRoads, minorRoads, powerItems, weatherItems, totalCount } =
    useMemo(() => {
      const major = [];
      const minor = [];
      const power = [];
      const weatherList = [];

      if (filters.roads) {
        const roadGroups = {};
        roads.forEach((r) => {
          if (!HAZARD_RE.test(r.condition)) return;
          if (!roadGroups[r.highway]) roadGroups[r.highway] = [];
          roadGroups[r.highway].push(r);
        });

        Object.entries(roadGroups).forEach(([hwy, segments]) => {
          const conditions = [...new Set(segments.map((s) => s.condition))];
          const closed = segments.some((s) =>
            s.condition.toLowerCase().includes("closed")
          );
          const item = {
            highway: hwy,
            closed,
            label: getWorstLabel(conditions),
            segmentCount: segments.length,
            segments,
          };
          if (isMajorHighway(hwy)) major.push(item);
          else minor.push(item);
        });

        major.sort((a, b) => {
          if (a.closed !== b.closed) return a.closed ? -1 : 1;
          return b.segmentCount - a.segmentCount;
        });
        minor.sort((a, b) => b.segmentCount - a.segmentCount);
      }

      if (filters.power) {
        outages.forEach((o) => {
          const isAggregate = o.cause && /^\d+\s+active/.test(o.cause);
          power.push({
            type: "power",
            badge: "Power",
            lat: isAggregate ? null : o.latitude,
            lng: isAggregate ? null : o.longitude,
            title: o.utility,
            detail: `${o.cause || o.area}${o.customers_affected ? ` \u2014 ${o.customers_affected.toLocaleString()} customers affected` : ""}`,
            time: o.fetched_at,
            stripe: "border-l-[3px] border-l-nw-red",
          });
        });
      }

      if (filters.weather) {
        weather.forEach((w) => {
          const stripeKey =
            w.severity === "red"
              ? "border-l-[3px] border-l-nw-red"
              : w.severity === "orange"
                ? "border-l-[3px] border-l-nw-amber"
                : "border-l-[3px] border-l-yellow-400";
          weatherList.push({
            type: "weather",
            severity: w.severity,
            badge: "Weather",
            title: w.title,
            detail: `${w.region}${w.description ? ` \u2014 ${w.description.substring(0, 120)}` : ""}`,
            time: w.issued_at,
            stripe: stripeKey,
          });
        });
        weatherList.sort((a, b) => {
          const order = { red: 0, orange: 1, yellow: 2 };
          return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
        });
      }

      return {
        majorRoads: major,
        minorRoads: minor,
        powerItems: power,
        weatherItems: weatherList,
        totalCount: major.length + minor.length + power.length + weatherList.length,
      };
    }, [roads, outages, weather, filters]);

  const searchLower = search.toLowerCase();
  const filteredMajor = search
    ? majorRoads.filter((r) => `hwy ${r.highway}`.toLowerCase().includes(searchLower))
    : majorRoads;
  const filteredMinor = search
    ? minorRoads.filter((r) => `hwy ${r.highway}`.toLowerCase().includes(searchLower))
    : minorRoads;
  const filteredPower = search
    ? powerItems.filter((p) => p.title.toLowerCase().includes(searchLower) || p.detail.toLowerCase().includes(searchLower))
    : powerItems;
  const filteredWeather = search
    ? weatherItems.filter((w) => w.title.toLowerCase().includes(searchLower) || w.detail.toLowerCase().includes(searchLower))
    : weatherItems;

  const filteredTotal = filteredMajor.length + filteredMinor.length + filteredPower.length + filteredWeather.length;
  const minorDisplay = showMinor ? filteredMinor.slice(0, minorCount) : [];
  const minorRemaining = filteredMinor.length - minorCount;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h2 className="text-base font-semibold dark:text-white">
          Active alerts
        </h2>
        <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full dark:bg-gray-700 dark:text-gray-200">
          {filteredTotal}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="md:hidden p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-90 transition-all"
        >
          <SearchIcon />
        </button>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowMinor(false);
            setMinorCount(PAGE_SIZE);
          }}
          placeholder="Filter alerts..."
          className={`text-xs border border-nw-border rounded-md px-2.5 py-1.5 w-44 outline-none focus:ring-1 focus:ring-nw-blue focus:border-nw-blue dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-500 dark:focus:ring-blue-400 transition-all ${
            searchOpen ? "block" : "hidden"
          } md:block`}
        />
      </div>

      {filteredTotal === 0 ? (
        <div className="bg-white border border-nw-border rounded-lg p-4 text-sm text-gray-400 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-500 animate-fade-in">
          <svg className="w-4 h-4 inline mr-1.5 text-nw-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {search ? `No alerts matching "${search}"` : "All clear \u2014 no active alerts"}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPower.map((item, i) => (
            <AlertCard key={`power-${i}`} item={item} delay={i * 30} onFlyTo={onAlertClick} />
          ))}

          {filteredWeather.map((item, i) => (
            <AlertCard key={`weather-${i}`} item={item} delay={i * 30} />
          ))}

          {filteredMajor.length > 0 && (
            <>
              {(filteredPower.length > 0 || filteredWeather.length > 0) && (
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 pt-2 pb-0.5">
                  Major highways
                </div>
              )}
              {filteredMajor.map((item, i) => (
                <RoadCard
                  key={item.highway}
                  item={item}
                  expanded={expanded.has(item.highway)}
                  onToggle={toggleExpand}
                  onFlyTo={onAlertClick}
                  delay={Math.min(i, 10) * 30}
                />
              ))}
            </>
          )}

          {filteredMinor.length > 0 && (
            <>
              <button
                onClick={() => setShowMinor(!showMinor)}
                className="w-full py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-nw-border dark:border-gray-700 rounded-lg active:scale-[0.995] transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ChevronIcon open={showMinor} />
                {showMinor
                  ? "Hide minor roads"
                  : `${filteredMinor.length} minor road${filteredMinor.length > 1 ? "s" : ""} with conditions`}
              </button>
              {showMinor && (
                <>
                  {minorDisplay.map((item, i) => (
                    <RoadCard
                      key={item.highway}
                      item={item}
                      expanded={expanded.has(item.highway)}
                      onToggle={toggleExpand}
                      onFlyTo={onAlertClick}
                      delay={Math.min(i, 8) * 20}
                    />
                  ))}
                  {minorRemaining > 0 && (
                    <button
                      onClick={() => setMinorCount((c) => c + PAGE_SIZE)}
                      className="w-full py-2 text-xs font-medium text-nw-blue bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-400 rounded-lg active:scale-[0.995] transition-all cursor-pointer"
                    >
                      Show more
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
