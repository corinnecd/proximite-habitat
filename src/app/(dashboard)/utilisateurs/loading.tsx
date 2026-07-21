export default function UtilisateursLoading() {
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
          <div className="h-9 w-40 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-72 bg-white/10 rounded animate-pulse" />
        </div>
        {/* User cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                </div>
              </div>
              <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
