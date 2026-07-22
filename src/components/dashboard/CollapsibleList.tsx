"use client";

import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function CollapsibleList<T extends { id: string }>({ items, renderItem, limit = 5 }: { items: T[]; renderItem: (item: T, idx: number, total: number) => React.ReactNode; limit?: number }) {
  const [showAll, setShowAll] = React.useState(false);
  const visible = showAll ? items : items.slice(0, limit);
  const hasMore = items.length > limit;
  return (
    <>
      {visible.map((item, idx) => renderItem(item, idx, visible.length))}
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full px-4 py-2.5 text-center text-xs text-muted-foreground hover:bg-secondary/40 transition-colors border-t border-border flex items-center justify-center gap-1"
        >
          {showAll
            ? <><ChevronUp className="w-3.5 h-3.5" />Voir moins</>
            : <><ChevronDown className="w-3.5 h-3.5" />Voir plus ({items.length - limit} restante{items.length - limit > 1 ? "s" : ""})</>}
        </button>
      )}
    </>
  );
}
