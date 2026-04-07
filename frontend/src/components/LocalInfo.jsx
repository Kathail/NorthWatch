import { useState, useEffect } from "react";

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(date) {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function LocalInfo() {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch("/api/v1/local-weather?city=Sudbury,Ontario")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (!data.error) setWeather(data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-6xl mx-auto flex-wrap gap-x-4 gap-y-1">
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {formatDate(now)}
        </span>
        <span className="text-gray-300 dark:text-gray-600">&middot;</span>
        <span>{formatTime(now)}</span>
      </div>
      {weather && (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {weather.temp_c}°C
          </span>
          <span>{weather.description}</span>
          <span className="text-gray-300 dark:text-gray-600">&middot;</span>
          <span>Feels like {weather.feels_like_c}°C</span>
          <span className="text-gray-300 dark:text-gray-600">&middot;</span>
          <span>Wind {weather.wind_kmph} km/h</span>
          <span className="text-gray-300 dark:text-gray-600">&middot;</span>
          <span>{weather.city}</span>
        </div>
      )}
    </div>
  );
}
