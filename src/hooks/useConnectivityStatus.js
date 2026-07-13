import { useCallback, useEffect, useState } from "react";

const PENDING_SYNC_KEY = "childkeeper_pending_sync";
const SYNC_ERROR_KEY = "childkeeper_sync_error";
const STALE_VERSION_KEY = "childkeeper_stale_client";

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(SYNC_ERROR_KEY) || "",
  );
  const [isStaleVersion, setIsStaleVersion] = useState(
    typeof window === "undefined"
      ? false
      : window.localStorage.getItem(STALE_VERSION_KEY) === "1",
  );

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
    setIsSyncing(false);
    writePendingSync(true);
  }, []);

  const markSyncing = useCallback(() => {
    setIsSyncing(true);
  }, []);

  const clearPendingSync = useCallback(() => {
    setHasPendingSync(false);
    setIsSyncing(false);
    writePendingSync(false);
  }, []);

  const markSyncError = useCallback((message) => {
    const value = String(message || "Sync failed");
    setSyncError(value);
    setIsSyncing(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SYNC_ERROR_KEY, value);
    }
  }, []);

  const clearSyncError = useCallback(() => {
    setSyncError("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SYNC_ERROR_KEY);
    }
  }, []);

  const markStaleVersion = useCallback((value) => {
    const stale = Boolean(value);
    setIsStaleVersion(stale);
    if (typeof window !== "undefined") {
      if (stale) {
        window.localStorage.setItem(STALE_VERSION_KEY, "1");
      } else {
        window.localStorage.removeItem(STALE_VERSION_KEY);
      }
    }
  }, []);

  return {
    isOnline,
    hasPendingSync,
    isSyncing,
    syncError,
    isStaleVersion,
    markPendingSync,
    markSyncing,
    clearPendingSync,
    markSyncError,
    clearSyncError,
    markStaleVersion,
  };
}
