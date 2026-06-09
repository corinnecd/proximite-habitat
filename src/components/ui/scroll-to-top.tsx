"use client";
import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() { setVisible(window.scrollY > 320); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Retour en haut"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
      style={{ animation: "fadeIn 0.2s ease" }}
    >
      <ChevronUp className="w-5 h-5" />
    </button>
  );
}
