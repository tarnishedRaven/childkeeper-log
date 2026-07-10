export default function SyncStatusBanner({ isOnline, hasPendingSync }) {
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
