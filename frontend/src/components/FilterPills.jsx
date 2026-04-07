import { useState } from "react";

function timeAgo(isoString) {
  if (!isoString) return "--";
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

const PILLS = [
  {
    key: "roads",
    label: "Roads",
    active:
      "bg-blue-50 text-nw-blue border-nw-blue dark:bg-blue-950 dark:border-nw-blue",
  },
  {
    key: "power",
    label: "Power",
    active:
      "bg-red-50 text-nw-red border-nw-red dark:bg-red-950 dark:border-nw-red",
  },
  {
    key: "weather",
    label: "Weather",
    active:
      "bg-amber-50 text-nw-amber border-nw-amber dark:bg-amber-950 dark:border-nw-amber",
  },
];

export default function FilterPills({
  filters,
  onToggle,
  onReset,
  lastUpdated,
  tick,
  counts,
  onRefresh,
}) {
  void tick;
  const [spinning, setSpinning] = useState(false);
  const staleMin = lastUpdated
    ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60000)
    : 999;
  const allActive = filters.roads && filters.power && filters.weather;

  function handleRefresh() {
    setSpinning(true);
    onRefresh();
    setTimeout(() => setSpinning(false), 600);
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-nw-border dark:border-gray-700 flex-wrap gap-2">
      <div className="flex items-center gap-1.5">
        {PILLS.map((p) => (
          <button
            key={p.key}
            onClick={() => onToggle(p.key)}
            className={`text-xs px-3 py-1 rounded-full border cursor-pointer transition-all active:scale-95 flex items-center gap-1 ${
              filters[p.key]
                ? p.active
                : "bg-white text-gray-400 border-nw-border dark:bg-gray-800 dark:text-gray-500 dark:border-gray-600"
            }`}
          >
            {p.label}
            {counts && counts[p.key] > 0 && (
              <span className="text-[10px] font-semibold opacity-70 min-w-[14px] text-center">
                {counts[p.key]}
              </span>
            )}
          </button>
        ))}
        {!allActive && (
          <button
            onClick={onReset}
            className="text-[10px] text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 px-1.5 active:scale-95 transition-all"
          >
            Reset
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs whitespace-nowrap ${
            staleMin > 30
              ? "text-nw-red font-semibold"
              : "text-gray-400 dark:text-gray-500"
          }`}
        >
          {timeAgo(lastUpdated)}
        </span>
        <button
          onClick={handleRefresh}
          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-90 transition-all"
          title="Refresh now"
        >
          <svg
            className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 ${spinning ? "animate-spin-once" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
