"use client";
import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "./CommandPalette";

const SearchCtx = createContext<{ open: () => void }>({ open: () => {} });
export const useSearch = () => useContext(SearchCtx);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const openPalette = useCallback(() => setIsOpen(true), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // ⌘K / Ctrl+K → palette de recherche
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
        return;
      }
      // N → nouvelle fiche (hors champ de saisie)
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditable = tag === "input" || tag === "textarea" || tag === "select"
        || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "n" && !isEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        router.push("/fiches/nouvelle");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <SearchCtx.Provider value={{ open: openPalette }}>
      {children}
      <CommandPalette open={isOpen} onClose={() => setIsOpen(false)} />
    </SearchCtx.Provider>
  );
}
