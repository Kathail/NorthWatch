import { useEffect } from "react";

export default function AboutModal({ onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 animate-fade-in"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-slide-up border border-nw-border dark:border-gray-700">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none active:scale-90 transition-all"
        >
          &times;
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-[#97C459] inline-block" />
          <h2 className="text-lg font-semibold dark:text-white">NorthWatch</h2>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
            v1.0
          </span>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
          A real-time status hub for Northern Ontario residents, aggregating
          road conditions, power outages, and weather alerts into a single
          dashboard.
        </p>

        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
          Data Sources
        </h3>
        <div className="space-y-2 mb-5">
          <div className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-nw-blue mt-1.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium dark:text-white">
                Ontario 511
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Road conditions refreshed every 10 minutes
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-nw-amber mt-1.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium dark:text-white">
                Environment Canada
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Weather alerts refreshed every 15 minutes
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-nw-red mt-1.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium dark:text-white">
                Hydro One + Lakeland Power
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Outage data refreshed every 10 minutes. Hydro One totals via
                Kubra, Lakeland Power individual outages via their outage map.
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-nw-border dark:border-gray-700 pt-4">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Built for Northern Ontario
          </span>
        </div>
      </div>
    </div>
  );
}
