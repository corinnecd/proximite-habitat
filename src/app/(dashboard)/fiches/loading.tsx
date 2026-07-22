export default function FichesLoading() {
  return (
    <>
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
        <div className="h-5 w-44 bg-muted rounded animate-pulse" />
        <div className="flex-1" />
        <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
      </div>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        {/* Hero skeleton */}
        <div className="bg-[#1E3A5F] rounded-3xl p-6 sm:p-7 space-y-4">
          <div className="h-3 w-28 bg-white/10 rounded animate-pulse" />
          <div className="h-9 w-52 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-64 bg-white/10 rounded animate-pulse" />
          <div className="h-11 w-full bg-white/8 rounded-full animate-pulse mt-4" />
        </div>
        {/* Status chips skeleton */}
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-muted rounded-full animate-pulse" />
          ))}
        </div>
        {/* List skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-muted rounded-xl animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                <div className="h-3 w-32 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
