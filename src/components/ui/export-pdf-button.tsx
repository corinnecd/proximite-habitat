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

    // Tag de style temporaire — nettoyé dans le finally
    const captureStyle = document.createElement("style");
    captureStyle.id = "__pdf-capture-override__";
    let savedScrollY = 0;

    try {
      await preloadPromise;
      const html2canvas = html2canvasLib!;
      const jsPDF = jsPDFLib!;

      const main = document.querySelector("main") as HTMLElement | null;
      if (!main) {
        setLoading(false);
        return;
      }

      // ── 1. Injecter une feuille de style temporaire dans le <head> live ──
      //
      // POURQUOI ce choix plutôt que setProperty() sur les éléments ?
      // → React peut ré-écraser les styles inline pendant le setTimeout/rAF.
      // → Une <style> injectée dans document.head n'est pas gérée par React.
      // → html2canvas clone document.documentElement (incluant <head>) avant
      //   d'ouvrir l'iframe, donc ce tag voyage dans le clone et s'applique
      //   aussi dans l'iframe isolée.
      // → !important dans un stylesheet d'auteur bat les animations CSS
      //   et les styles inline sans !important.
      // Neutralise les animations sur la page live (les <style> survivent au clone)
      // NB: on n'y met PAS .hero-surface — color:#fff cascaderait aux boutons
      // et les rendrait invisibles sur fond blanc pendant la capture.
      captureStyle.textContent = `
        [class*="animate-"],
        [style*="animation"] {
          animation: none !important;
          animation-delay: 0s !important;
          opacity: 1 !important;
          transform: none !important;
          transition: none !important;
        }
      `;
      document.head.appendChild(captureStyle);

      // Scroll au top pour que html2canvas capture depuis le début du contenu
      savedScrollY = window.scrollY;
      window.scrollTo({ top: 0, behavior: "instant" });

      // Attendre que le navigateur applique les styles + scroll (2 frames ≈ 32ms)
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      // ── 2. Capture ────────────────────────────────────────────────────────
      const canvas = await html2canvas(main, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        removeContainer: false,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc: Document, clonedMain: HTMLElement) => {
          // Hero : var(--hero) ne se résout pas dans l'iframe isolée → couleurs hardcodées.
          // Fait ici (clone) et non dans captureStyle (page live) pour ne pas
          // cascader color:#fff sur les boutons de la page réelle.
          clonedMain.querySelectorAll<HTMLElement>(".hero-surface").forEach((el) => {
            el.style.setProperty("background-color", "#1E3A5F", "important");
            el.style.setProperty("color", "#FFFFFF", "important");
            el.style.setProperty("overflow", "visible", "important");
          });

          // Supprimer la troncature du titre dans la Topbar
          clonedMain.querySelectorAll<HTMLElement>(".truncate").forEach((el) => {
            el.style.setProperty("overflow", "visible", "important");
            el.style.setProperty("text-overflow", "unset", "important");
            el.style.setProperty("white-space", "normal", "important");
          });

          // Masquer les éléments non destinés à l'export (display:none = pas d'espace blanc)
          clonedMain
            .querySelectorAll<HTMLElement>("[data-no-print]")
            .forEach((el) => el.style.setProperty("display", "none", "important"));
          clonedMain
            .querySelectorAll<HTMLElement>(
              ".leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-attribution, [data-fs-btn]"
            )
            .forEach((el) => el.style.setProperty("display", "none", "important"));
        },
      });

      // ── 3. Générer le PDF ─────────────────────────────────────────────────
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
      captureStyle.remove();
      if (savedScrollY > 0) window.scrollTo({ top: savedScrollY, behavior: "instant" });
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
