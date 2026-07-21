export default function PlanificationLoading() {
  return (
    <>
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        <div className="flex-1" />
        <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
      </div>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Hero skeleton */}
        <div className="bg-[#1E3A5F] rounded-3xl p-6 sm:p-7 space-y-4">
          <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
          <div className="h-9 w-44 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-56 bg-white/10 rounded animate-pulse" />
        </div>
        {/* Week nav skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-9 w-9 bg-muted rounded-lg animate-pulse" />
          <div className="h-5 w-52 bg-muted rounded animate-pulse" />
          <div className="h-9 w-9 bg-muted rounded-lg animate-pulse" />
        </div>
        {/* Map + zones skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="h-64 bg-muted/30 rounded-xl animate-pulse" />
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/50 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
