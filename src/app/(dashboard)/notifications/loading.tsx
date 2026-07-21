export default function NotificationsLoading() {
  return (
    <>
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        <div className="flex-1" />
        <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
      </div>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        {/* Hero skeleton */}
        <div className="bg-[#1E3A5F] rounded-3xl p-6 sm:p-7 space-y-4">
          <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
          <div className="h-9 w-44 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-48 bg-white/10 rounded animate-pulse" />
        </div>
        {/* Notification list skeleton */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 bg-muted rounded-lg animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-56 bg-muted rounded animate-pulse" />
                <div className="h-3 w-40 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-3 w-12 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
