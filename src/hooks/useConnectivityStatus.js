import { useCallback, useEffect, useState } from "react";

const PENDING_SYNC_KEY = "childkeeper_pending_sync";

function readPendingSync() {
  if (typeof window === "undefined") return false;

  return window.localStorage.getItem(PENDING_SYNC_KEY) === "1";
}

function writePendingSync(value) {
  if (typeof window === "undefined") return;

  if (value) {
    window.localStorage.setItem(PENDING_SYNC_KEY, "1");
    return;
  }

  window.localStorage.removeItem(PENDING_SYNC_KEY);
}

export default function useConnectivityStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [hasPendingSync, setHasPendingSync] = useState(readPendingSync);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const markPendingSync = useCallback(() => {
    setHasPendingSync(true);
    writePendingSync(true);
  }, []);

  const clearPendingSync = useCallback(() => {
    setHasPendingSync(false);
    writePendingSync(false);
  }, []);

  return {
    isOnline,
    hasPendingSync,
    markPendingSync,
    clearPendingSync,
  };
}
