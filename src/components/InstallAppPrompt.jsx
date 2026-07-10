import { useEffect, useState } from "react";

const DISMISSED_NATIVE_KEY = "childkeeper_install_prompt_dismissed";
const DISMISSED_IOS_KEY = "childkeeper_ios_install_hint_dismissed";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOSSafari() {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent);
  const isSafari = /Safari/.test(userAgent);
  const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS/.test(userAgent);

  return isIOSDevice && isSafari && !isOtherIOSBrowser;
}

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [isHidden, setIsHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    if (isStandaloneMode()) {
      setIsHidden(true);
      return undefined;
    }

    const nativeDismissed =
      window.localStorage.getItem(DISMISSED_NATIVE_KEY) === "1";
    const iosDismissed =
      window.localStorage.getItem(DISMISSED_IOS_KEY) === "1";

    if (!iosDismissed && isIOSSafari()) {
      setShowIOSHint(true);
      setIsHidden(false);
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      if (!nativeDismissed) {
        setDeferredPrompt(event);
        setIsHidden(false);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsHidden(true);
  };

  const handleDismissNative = () => {
    window.localStorage.setItem(DISMISSED_NATIVE_KEY, "1");
    setDeferredPrompt(null);
    setIsHidden(true);
  };

  const handleDismissIOS = () => {
    window.localStorage.setItem(DISMISSED_IOS_KEY, "1");
    setShowIOSHint(false);
    setIsHidden(true);
  };

  if (isHidden || (!deferredPrompt && !showIOSHint)) {
    return null;
  }

  const isNativePromptVisible = Boolean(deferredPrompt);

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-lg border border-figma-border bg-figma-surface shadow-lg">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-white">
          {isNativePromptVisible ? "Install app" : "Add to Home Screen"}
        </h2>
        {isNativePromptVisible ? (
          <p className="mt-1 text-sm text-figma-text-secondary">
            Install Childkeeper&apos;s Log for faster access and a full-screen app
            experience.
          </p>
        ) : (
          <p className="mt-1 text-sm text-figma-text-secondary">
            In Safari, tap
            <span className="mx-1 inline-flex items-center gap-1 rounded-md border border-figma-border bg-figma-elevated px-2 py-0.5 text-xs text-white align-middle">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 16V4" />
                <path d="M8.5 7.5L12 4l3.5 3.5" />
                <path d="M5 12.5v5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-5" />
              </svg>
              Share
            </span>
            then choose Add to Home Screen.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          {isNativePromptVisible && (
            <button
              type="button"
              onClick={handleInstall}
              className="px-3 py-2 text-sm bg-figma-accent text-white rounded-md hover:bg-figma-accent-hover transition"
            >
              Install
            </button>
          )}
          <button
            type="button"
            onClick={
              isNativePromptVisible ? handleDismissNative : handleDismissIOS
            }
            className="px-3 py-2 text-sm bg-figma-elevated text-white rounded-md hover:bg-[#464646] transition"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
