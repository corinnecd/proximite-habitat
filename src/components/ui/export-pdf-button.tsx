"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";

// Preloaded libs — cached after first load
let html2canvasLib: typeof import("html2canvas-pro")["default"] | null = null;
let jsPDFLib: typeof import("jspdf")["jsPDF"] | null = null;
const preloadPromise = typeof window !== "undefined"
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

  // Preload libs on mount (no-op if already loaded)
  useEffect(() => { preloadPromise; }, []);

  function showToast(message: string) {
    if (toastRef.current) toastRef.current.remove();
    const el = document.createElement("div");
    el.textContent = message;
    Object.assign(el.style, {
      position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
      background: "#1e3a5f", color: "#fff", padding: "10px 24px", borderRadius: "8px",
      fontSize: "14px", fontWeight: "500", zIndex: "9999", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      transition: "opacity 0.3s", opacity: "1",
    });
    document.body.appendChild(el);
    toastRef.current = el;
    setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 2500);
  }

  async function handleExport() {
    setLoading(true);
    showToast("Génération du PDF en cours…");
    try {
      await preloadPromise;
      const html2canvas = html2canvasLib!;
      const jsPDF = jsPDFLib!;

      const main = document.querySelector("main") as HTMLElement | null;
      if (!main) { setLoading(false); return; }

      // Capture directement le DOM live (sans cloner) afin de préserver
      // les transforms CSS Leaflet — la SVG polyline apparaît alors dans le PDF.
      // On masque temporairement les éléments interactifs via une classe CSS.
      const style = document.createElement("style");
      style.setAttribute("data-pdf-print-style", "1");
      style.textContent = `
        body.pdf-printing button:not(.leaflet-control button):not([data-fs-btn]),
        body.pdf-printing input,
        body.pdf-printing select,
        body.pdf-printing [data-no-print] { visibility: hidden !important; }
        body.pdf-printing .leaflet-control-zoom,
        body.pdf-printing .leaflet-control-layers,
        body.pdf-printing .leaflet-control-attribution,
        body.pdf-printing [data-fs-btn] { display: none !important; }
      `;
      document.head.appendChild(style);
      document.body.classList.add("pdf-printing");

      // Attendre 1 frame pour laisser le repaint
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      let canvas;
      try {
        // Attendre que Leaflet finisse de rendre (500ms minimum)
        await new Promise((r) => setTimeout(r, 500));

        canvas = await html2canvas(main, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          removeContainer: false,
        });
      } finally {
        document.body.classList.remove("pdf-printing");
        style.remove();
      }

      const imgWidth = 190;
      const pageHeight = 277;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF("p", "mm", "a4");
      const dateStr = new Date().toLocaleDateString("fr-FR", {
        day: "2-digit", month: "long", year: "numeric",
      });

      pdf.setFontSize(14);
      pdf.setTextColor(30, 58, 95);
      pdf.text(title, 10, 12);
      if (subtitle) {
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        pdf.text(subtitle, 10, 18);
      }

      pdf.setDrawColor(249, 115, 22);
      pdf.setLineWidth(0.5);
      pdf.line(10, subtitle ? 20 : 15, 200, subtitle ? 20 : 15);

      const startY = subtitle ? 23 : 18;
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
        ctx.drawImage(canvas, 0, srcY * (canvas.height / imgHeight), canvas.width, sliceCanvasHeight, 0, 0, canvas.width, sliceCanvasHeight);

        const sliceData = sliceCanvas.toDataURL("image/png");
        const y = srcY === 0 ? startY : 10;
        pdf.addImage(sliceData, "PNG", 10, y, imgWidth, sliceHeight);

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
