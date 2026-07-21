export default function ReportingLoading() {
  return (
    <>
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
        <div className="h-5 w-28 bg-muted rounded animate-pulse" />
        <div className="flex-1" />
        <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
      </div>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Hero skeleton */}
        <div className="bg-[#1E3A5F] rounded-3xl p-6 sm:p-8 space-y-4">
          <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
          <div className="h-9 w-36 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-64 bg-white/10 rounded animate-pulse" />
          <div className="pt-5 border-t border-white/10 mt-4">
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 w-24 bg-white/8 rounded-full animate-pulse" />
              ))}
            </div>
          </div>
        </div>
        {/* KPI cards skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="w-10 h-10 bg-muted rounded-xl animate-pulse mb-3" />
              <div className="h-8 w-16 bg-muted rounded animate-pulse mb-2" />
              <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <div className="h-5 w-36 bg-muted rounded animate-pulse mb-4" />
              <div className="h-48 bg-muted/30 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
