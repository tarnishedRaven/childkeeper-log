export default function SyncStatusBanner({
  isOnline,
  hasPendingSync,
  isSyncing = false,
  syncError = "",
  isStaleVersion = false,
}) {
  if (isStaleVersion) {
    return (
      <div className="mb-4 p-3 rounded-md border border-red-300/50 bg-red-500/10">
        <p className="text-sm text-red-100">
          This app version is out of date. Reload to continue making changes.
        </p>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="mb-4 p-3 rounded-md border border-amber-300/50 bg-amber-500/10">
        <p className="text-sm text-amber-200">
          You are offline. New changes are saved locally and will sync when your
          connection returns.
        </p>
      </div>
    );
  }

  if (syncError) {
    return (
      <div className="mb-4 p-3 rounded-md border border-red-300/50 bg-red-500/10">
        <p className="text-sm text-red-100">Sync failed: {syncError}</p>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="mb-4 p-3 rounded-md border border-indigo-300/50 bg-indigo-500/10">
        <p className="text-sm text-indigo-100">
          Syncing your local updates to Firestore.
        </p>
      </div>
    );
  }

  if (hasPendingSync) {
    return (
      <div className="mb-4 p-3 rounded-md border border-blue-300/50 bg-blue-500/10">
        <p className="text-sm text-blue-100">
          You are back online. Waiting for local changes to finish syncing.
        </p>
      </div>
    );
  }

  return null;
}
