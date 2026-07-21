export default function ProfilLoading() {
  return (
    <>
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
        <div className="h-5 w-28 bg-muted rounded animate-pulse" />
        <div className="flex-1" />
      </div>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Hero skeleton */}
        <div className="bg-[#1E3A5F] rounded-3xl p-6 sm:p-7">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/10 rounded-full animate-pulse" />
            <div className="space-y-2">
              <div className="h-7 w-40 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-48 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
        {/* Form sections skeleton */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="h-5 w-36 bg-muted rounded animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-10 bg-muted/50 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
