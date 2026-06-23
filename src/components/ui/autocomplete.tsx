"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, ChevronDown } from "lucide-react";

export interface AutocompleteOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface AutocompleteProps {
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Autocomplete({ options, value, onChange, placeholder = "Rechercher…", disabled, className = "" }: AutocompleteProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = query.trim()
    ? options.filter((o) => {
        const q = query.toLowerCase();
        return o.label.toLowerCase().includes(q) || (o.sublabel?.toLowerCase().includes(q) ?? false);
      })
    : options;

  const visibleOptions = filtered.slice(0, 100);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [query]);

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const handleSelect = useCallback((optValue: string) => {
    onChange(optValue);
    setQuery("");
    setOpen(false);
  }, [onChange]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, visibleOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(visibleOptions[highlightIndex].value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center h-12 rounded-xl border border-border bg-card px-3 gap-2 transition-all ${
          open ? "ring-2 ring-primary/30 border-primary/50" : ""
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-text"}`}
        onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus(); } }}
      >
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selected ? selected.label : placeholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            autoFocus
          />
        ) : (
          <span className={`flex-1 text-sm truncate ${selected ? "text-foreground" : "text-muted-foreground/60"}`}>
            {selected ? selected.label : placeholder}
          </span>
        )}
        {value && !disabled ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); setQuery(""); }}
            className="w-5 h-5 rounded-full hover:bg-muted flex items-center justify-center shrink-0"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 left-0 right-0 top-full mt-1 max-h-[280px] overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
        >
          {visibleOptions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground text-center">Aucun résultat</p>
          ) : (
            visibleOptions.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  i === highlightIndex
                    ? "bg-primary/10 text-primary"
                    : opt.value === value
                      ? "bg-[#F97316]/10 text-[#F97316] font-medium"
                      : "hover:bg-secondary text-foreground"
                }`}
              >
                <span className="block">{opt.label}</span>
                {opt.sublabel && <span className="block text-[10px] text-muted-foreground">{opt.sublabel}</span>}
              </button>
            ))
          )}
          {filtered.length > 100 && (
            <p className="px-4 py-2 text-[10px] text-muted-foreground text-center border-t border-border">
              {filtered.length - 100} résultats supplémentaires — affinez votre recherche
            </p>
          )}
        </div>
      )}
    </div>
  );
}
