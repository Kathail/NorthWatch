import { useState } from "react";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "roads", label: "Roads" },
  { key: "power", label: "Power" },
  { key: "weather", label: "Weather" },
  { key: "about", label: "About" },
];

export default function Header({ activeNav, onNav }) {
  const [open, setOpen] = useState(false);

  function handleClick(key) {
    setOpen(false);
    onNav(key);
  }

  return (
    <header className="bg-nw-dark px-5 py-3.5 relative z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <button
          className="flex items-center gap-2 active:opacity-80 transition-opacity"
          onClick={() => handleClick("dashboard")}
        >
          <span className="w-2 h-2 rounded-full bg-[#97C459] inline-block" />
          <span className="text-white font-medium text-lg tracking-tight">
            NorthWatch
          </span>
        </button>

        <button
          className="lg:hidden flex flex-col gap-1 p-2 -mr-2 active:opacity-70 transition-opacity"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation"
        >
          <span
            className={`block w-5 h-0.5 bg-white rounded transition-transform ${open ? "rotate-45 translate-y-[6px]" : ""}`}
          />
          <span
            className={`block w-5 h-0.5 bg-white rounded transition-opacity ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`block w-5 h-0.5 bg-white rounded transition-transform ${open ? "-rotate-45 -translate-y-[6px]" : ""}`}
          />
        </button>

        <nav
          className={`${
            open ? "flex animate-slide-down" : "hidden"
          } lg:flex flex-col lg:flex-row gap-3 lg:gap-6 absolute lg:static top-14 right-5 bg-nw-dark lg:bg-transparent p-4 lg:p-0 rounded-lg lg:rounded-none z-50 border border-gray-700 lg:border-0 shadow-lg lg:shadow-none`}
        >
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => handleClick(item.key)}
              className={`text-sm transition-colors active:opacity-70 text-left ${
                activeNav === item.key
                  ? "text-white"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </header>
  );
}
