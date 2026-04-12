/**
 * Fallback UI for React.lazy route chunks and heavy deferred components (maps, etc.).
 */
export function PageLoadingFallback() {
  return (
    <div
      className="route-loading-fallback"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        gap: '12px',
        color: '#013727',
        fontFamily: 'system-ui, sans-serif',
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '3px solid #e5e7eb',
          borderTopColor: '#05c65d',
          borderRadius: '50%',
          animation: 'route-loading-spin 0.8s linear infinite',
        }}
      />
      <span style={{ fontSize: 14, fontWeight: 600 }}>Loading…</span>
      <style>{`
        @keyframes route-loading-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/** Inline placeholder while a map chunk downloads (keeps layout stable). */
export function MapChunkFallback({ minHeight = 320 }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading map"
      style={{
        minHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6',
        borderRadius: 12,
        color: '#6b7280',
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      Loading map…
    </div>
  );
}

export default PageLoadingFallback;
