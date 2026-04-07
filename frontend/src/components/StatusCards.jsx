const CHECK_ICON = (
  <svg
    className="w-3 h-3 inline"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function Card({ label, count, subtitle, colorClass, icon, onClick, delay }) {
  return (
    <div
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={`bg-white border border-nw-border rounded-lg p-4 dark:bg-gray-900 dark:border-gray-700 animate-fade-slide-up group ${
        onClick
          ? "cursor-pointer active:scale-[0.97] transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600"
          : ""
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 uppercase tracking-wide dark:text-gray-400">
          {label}
        </span>
        {icon}
      </div>
      <div className={`text-2xl font-medium ${colorClass}`}>
        {count ?? "--"}
      </div>
      <div className="text-xs text-gray-400 mt-1 dark:text-gray-500">
        {subtitle}
      </div>
      {onClick && (
        <div className="text-[10px] text-gray-300 dark:text-gray-600 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          Tap to filter
        </div>
      )}
    </div>
  );
}

export default function StatusCards({ status, onCardClick }) {
  if (!status) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border border-nw-border rounded-lg p-4 animate-pulse h-24 dark:bg-gray-900 dark:border-gray-700"
          />
        ))}
      </div>
    );
  }

  const total = status.road_alerts + status.highways_clear;
  const clearPct = total > 0 ? Math.round((status.highways_clear / total) * 100) : 0;

  const powerSub =
    status.power_outages === 0 ? (
      <span className="text-nw-green">
        {CHECK_ICON} No outages reported
      </span>
    ) : (
      `${status.customers_affected.toLocaleString()} customers affected`
    );

  const weatherSub =
    status.weather_alerts === 0 ? (
      <span className="text-nw-green">
        {CHECK_ICON} No active warnings
      </span>
    ) : (
      `${status.weather_alerts} active`
    );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
      <Card
        label="Road alerts"
        count={status.road_alerts}
        subtitle={`${status.road_alerts} road section${status.road_alerts === 1 ? "" : "s"} affected`}
        colorClass="text-nw-blue"
        onClick={() => onCardClick("roads")}
        delay={0}
        icon={
          <svg className="w-4 h-4 text-nw-blue opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        }
      />
      <Card
        label="Power outages"
        count={status.power_outages}
        subtitle={powerSub}
        colorClass="text-nw-red"
        onClick={() => onCardClick("power")}
        delay={50}
        icon={
          <svg className="w-4 h-4 text-nw-red opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        }
      />
      <Card
        label="Weather alerts"
        count={status.weather_alerts}
        subtitle={weatherSub}
        colorClass="text-nw-amber"
        onClick={() => onCardClick("weather")}
        delay={100}
        icon={
          <svg className="w-4 h-4 text-nw-amber opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          </svg>
        }
      />
      <Card
        label="Roads clear"
        count={`${clearPct}%`}
        subtitle={`${status.highways_clear} of ${total} sections`}
        colorClass="text-nw-green"
        delay={150}
        icon={
          <svg className="w-4 h-4 text-nw-green opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        }
      />
    </div>
  );
}
