export default function DashboardLoading() {
  return (
    <>
      {/* Topbar skeleton */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
        <div className="h-5 w-36 bg-muted rounded animate-pulse" />
        <div className="flex-1" />
        <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
      </div>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Hero skeleton */}
        <div className="bg-[#1E3A5F] rounded-3xl p-6 sm:p-8 space-y-4">
          <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
          <div className="h-10 w-48 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-72 bg-white/10 rounded animate-pulse" />
          <div className="flex gap-2 mt-4">
            <div className="h-9 w-36 bg-white/10 rounded-full animate-pulse" />
            <div className="h-9 w-28 bg-white/10 rounded-full animate-pulse" />
          </div>
          <div className="pt-5 border-t border-white/10 mt-4">
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 w-20 bg-white/8 rounded-full animate-pulse" />
              ))}
            </div>
          </div>
        </div>

        {/* Status counters skeleton */}
        <div className="hidden sm:grid grid-flow-col auto-cols-fr gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border border-l-4 border-l-muted rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="w-10 h-10 bg-muted rounded-xl animate-pulse mb-3" />
              <div className="h-8 w-12 bg-muted rounded animate-pulse mb-2" />
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* KPI cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border border-l-4 border-l-muted rounded-2xl p-5 shadow-sm">
              <div className="w-10 h-10 bg-muted rounded-xl animate-pulse mb-3" />
              <div className="h-8 w-24 bg-muted rounded animate-pulse mb-2" />
              <div className="h-3 w-32 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Tables skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-muted rounded-xl animate-pulse" />
                <div className="h-4 w-40 bg-muted rounded animate-pulse" />
              </div>
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-10 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
