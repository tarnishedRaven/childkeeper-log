import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function PwaUpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-figma-border bg-figma-surface shadow-lg">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-white">Update available</h2>
        <p className="mt-1 text-sm text-figma-text-secondary">
          A newer version of Childkeeper&apos;s Log is ready.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="px-3 py-2 text-sm bg-figma-accent text-white rounded-md hover:bg-figma-accent-hover transition"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="px-3 py-2 text-sm bg-figma-elevated text-white rounded-md hover:bg-[#464646] transition"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
