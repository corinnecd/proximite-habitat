"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";

// Preloaded libs — cached after first load
let html2canvasLib: typeof import("html2canvas-pro")["default"] | null = null;
let jsPDFLib: typeof import("jspdf")["jsPDF"] | null = null;
const preloadPromise =
  typeof window !== "undefined"
    ? Promise.all([import("html2canvas-pro"), import("jspdf")]).then(([h, j]) => {
        html2canvasLib = h.default;
        jsPDFLib = j.jsPDF;
      })
    : null;

interface ExportPdfButtonProps {
  title: string;
  subtitle?: string;
  contentSelector?: string;
  filename?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  printLayout?: "default" | "3col";
}

// Classes CSS qui démarrent des animations à opacity:0 / transform décalé.
// Dans l'iframe html2canvas ces animations REDÉMARRENT depuis le début,
// rendant les éléments invisibles (opacity:0) lors de la capture.
const ANIMATED_SELECTORS = [
  ".animate-hero-entry",
  ".animate-cascade > *",
  ".animate-counter-pop",
  ".animate-progress-reveal",
  ".animate-success-pop",
  ".animate-chip-tap",
].join(", ");

export function ExportPdfButton({
  title,
  subtitle,
  filename = "export",
  className,
  variant = "outline",
  size = "sm",
}: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false);
  const toastRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    preloadPromise;
  }, []);

  function showToast(message: string) {
    if (toastRef.current) toastRef.current.remove();
    const el = document.createElement("div");
    el.textContent = message;
    Object.assign(el.style, {
      position: "fixed",
      bottom: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#1e3a5f",
      color: "#fff",
      padding: "10px 24px",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "500",
      zIndex: "9999",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      transition: "opacity 0.3s",
      opacity: "1",
    });
    document.body.appendChild(el);
    toastRef.current = el;
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 300);
    }, 2500);
  }

  async function handleExport() {
    setLoading(true);
    showToast("Génération du PDF en cours…");
    try {
      await preloadPromise;
      const html2canvas = html2canvasLib!;
      const jsPDF = jsPDFLib!;

      const main = document.querySelector("main") as HTMLElement | null;
      if (!main) {
        setLoading(false);
        return;
      }

      // ── 1. Préparer le DOM live avant la capture ─────────────────────────
      //
      // PROBLÈME RACINE : html2canvas crée un clone du DOM puis l'adopte dans
      // un <iframe> isolé. Toutes les animations CSS (animation: heroEntry,
      // fadeSlideIn, counterPop…) REDÉMARRENT dans l'iframe, rendant les
      // éléments invisibles (opacity:0) au moment de la capture.
      //
      // SOLUTION : figer les animations + forcer l'état final (opacity:1,
      // transform:none) EN INLINE STYLE sur les éléments du DOM live.
      // Ces styles inline sont copiés dans le clone via cloneNode() et
      // l'iframe hérite donc des valeurs finales, pas de l'état initial.

      // Figer animations via classe (ex: animate-hero-entry, animate-cascade > *)
      main.querySelectorAll<HTMLElement>(ANIMATED_SELECTORS).forEach((el) => {
        el.style.setProperty("animation", "none", "important");
        el.style.setProperty("animation-delay", "0s", "important");
        el.style.setProperty("opacity", "1", "important");
        el.style.setProperty("transform", "none", "important");
        el.style.setProperty("transition", "none", "important");
      });

      // Figer animations inline (style="animation: fadeSlideIn…")
      // Ces éléments n'ont pas de classe animate- mais redémarrent à opacity:0
      main.querySelectorAll<HTMLElement>("[style*='animation']").forEach((el) => {
        el.style.setProperty("animation", "none", "important");
        el.style.setProperty("animation-delay", "0s", "important");
        el.style.setProperty("opacity", "1", "important");
        el.style.setProperty("transform", "none", "important");
      });

      // Hero : fond navy exact (résolution forcée de var(--hero))
      main.querySelectorAll<HTMLElement>(".hero-surface").forEach((el) => {
        el.style.setProperty("background-color", "#1E3A5F", "important");
        el.style.setProperty("color", "#FFFFFF", "important");
        el.style.setProperty("overflow", "visible", "important");
      });

      // Les boutons [data-no-print] ne sont masqués QUE dans le clone (onclone)
      // pour éviter qu'ils disparaissent visuellement à l'écran pendant la capture.
      main
        .querySelectorAll<HTMLElement>(
          ".leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-attribution, [data-fs-btn]"
        )
        .forEach((el) => el.style.setProperty("display", "none", "important"));

      // Laisser le navigateur repeindre
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await new Promise((r) => setTimeout(r, 300));

      // ── 2. Capture ────────────────────────────────────────────────────────
      const canvas = await html2canvas(main, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        removeContainer: false,
        onclone: (clonedDoc: Document, clonedMain: HTMLElement) => {
          // Double sécurité dans le clone (au cas où les styles inline
          // n'auraient pas été copiés ou auraient été écrasés)

          // Figer les animations dans le clone (classe)
          clonedMain.querySelectorAll<HTMLElement>(ANIMATED_SELECTORS).forEach((el) => {
            el.style.setProperty("animation", "none", "important");
            el.style.setProperty("animation-delay", "0s", "important");
            el.style.setProperty("opacity", "1", "important");
            el.style.setProperty("transform", "none", "important");
            el.style.setProperty("transition", "none", "important");
          });

          // Figer les animations inline dans le clone (style="animation: fadeSlideIn…")
          clonedMain.querySelectorAll<HTMLElement>("[style*='animation']").forEach((el) => {
            el.style.setProperty("animation", "none", "important");
            el.style.setProperty("animation-delay", "0s", "important");
            el.style.setProperty("opacity", "1", "important");
            el.style.setProperty("transform", "none", "important");
          });

          // Hero dans le clone
          clonedMain.querySelectorAll<HTMLElement>(".hero-surface").forEach((el) => {
            el.style.setProperty("background-color", "#1E3A5F", "important");
            el.style.setProperty("color", "#FFFFFF", "important");
            el.style.setProperty("overflow", "visible", "important");
          });

          // Supprimer la troncature .truncate (ex : titre du Topbar)
          clonedMain.querySelectorAll<HTMLElement>(".truncate").forEach((el) => {
            el.style.setProperty("overflow", "visible", "important");
            el.style.setProperty("text-overflow", "unset", "important");
            el.style.setProperty("white-space", "normal", "important");
          });

          // Masquer les éléments [data-no-print] dans le clone (display:none = pas d'espace blanc)
          clonedMain
            .querySelectorAll<HTMLElement>("[data-no-print]")
            .forEach((el) => el.style.setProperty("display", "none", "important"));
          clonedMain
            .querySelectorAll<HTMLElement>(
              ".leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-attribution, [data-fs-btn]"
            )
            .forEach((el) => el.style.setProperty("display", "none", "important"));

          // Injecter une règle globale dans le <head> du clone pour
          // neutraliser tout reste d'animation non ciblée ci-dessus
          const noAnim = clonedDoc.createElement("style");
          noAnim.textContent = `
            [class*="animate-"],
            [style*="animation"] {
              animation: none !important;
              animation-delay: 0s !important;
              opacity: 1 !important;
              transform: none !important;
              transition: none !important;
            }
            .hero-surface {
              background-color: #1E3A5F !important;
              color: #FFFFFF !important;
              overflow: visible !important;
            }
          `;
          clonedDoc.head.appendChild(noAnim);
        },
      });

      // ── 3. Restaurer le DOM ───────────────────────────────────────────────
      main.querySelectorAll<HTMLElement>(ANIMATED_SELECTORS).forEach((el) => {
        el.style.removeProperty("animation");
        el.style.removeProperty("animation-delay");
        el.style.removeProperty("opacity");
        el.style.removeProperty("transform");
        el.style.removeProperty("transition");
      });
      // Restaurer les éléments à animation inline
      main.querySelectorAll<HTMLElement>("[style*='animation']").forEach((el) => {
        el.style.removeProperty("animation");
        el.style.removeProperty("animation-delay");
        el.style.removeProperty("opacity");
        el.style.removeProperty("transform");
      });
      main.querySelectorAll<HTMLElement>(".hero-surface").forEach((el) => {
        el.style.removeProperty("background-color");
        el.style.removeProperty("color");
        el.style.removeProperty("overflow");
      });
      // [data-no-print] n'est PAS modifié sur le DOM live — pas de restore nécessaire.
      main
        .querySelectorAll<HTMLElement>(
          ".leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-attribution, [data-fs-btn]"
        )
        .forEach((el) => el.style.removeProperty("display"));

      // ── 4. Générer le PDF ─────────────────────────────────────────────────
      const imgWidth = 190;
      const pageHeight = 277;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF("p", "mm", "a4");
      const dateStr = new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      if (subtitle) {
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        pdf.text(subtitle, 10, 11);
      }
      pdf.setDrawColor(249, 115, 22);
      pdf.setLineWidth(0.5);
      pdf.line(10, subtitle ? 14 : 8, 200, subtitle ? 14 : 8);

      const startY = subtitle ? 17 : 11;
      let remainingHeight = imgHeight;
      let srcY = 0;

      while (remainingHeight > 0) {
        const currentPageHeight = srcY === 0 ? pageHeight - startY : pageHeight - 10;
        const sliceHeight = Math.min(remainingHeight, currentPageHeight);
        const sliceCanvasHeight = (sliceHeight / imgHeight) * canvas.height;

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceCanvasHeight;
        const ctx = sliceCanvas.getContext("2d")!;
        ctx.drawImage(
          canvas,
          0,
          srcY * (canvas.height / imgHeight),
          canvas.width,
          sliceCanvasHeight,
          0,
          0,
          canvas.width,
          sliceCanvasHeight
        );

        const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.85);
        const y = srcY === 0 ? startY : 10;
        pdf.addImage(sliceData, "JPEG", 10, y, imgWidth, sliceHeight);

        remainingHeight -= sliceHeight;
        srcY += sliceHeight;
        if (remainingHeight > 0) pdf.addPage();
      }

      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(160, 160, 160);
        pdf.text(`Proximité Habitat Conseil · Exporté le ${dateStr}`, 10, 290);
        pdf.text(`${i} / ${totalPages}`, 195, 290, { align: "right" });
      }

      pdf.save(`${filename}.pdf`);
      showToast("✓ PDF téléchargé avec succès");
    } catch (e) {
      console.error("[PDF export]", e);
      showToast("Erreur lors de l'export PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={loading}
      className={`gap-2 ${className ?? ""}`}
      data-no-print
    >
      <FileDown className="w-4 h-4" />
      Exporter PDF
    </Button>
  );
}
