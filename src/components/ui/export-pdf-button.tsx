"use client";

import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

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
  filename,
  className,
  variant = "outline",
  size = "sm",
  printLayout = "default",
}: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false);

  function handlePrint() {
    setLoading(true);

    const styleId = "__pdf-print-style__";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }

    const dateStr = new Date().toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
    });

    const safeTitle = title.replace(/"/g, "'");
    const safeSubtitle = subtitle ? " — " + subtitle.replace(/"/g, "'") : "";

    style.textContent = `
      @media print {
        /* ── Masquer tout sauf le contenu principal ── */
        body > * { display: none !important; }
        body > * > * > main,
        #__next main,
        [data-pdf-content] { display: block !important; }

        /* ── En-tête et pied de page PDF ── */
        body::before {
          content: "${safeTitle}${safeSubtitle}";
          display: block;
          font-size: 15px;
          font-weight: 700;
          color: #1E3A5F;
          padding-bottom: 6px;
          border-bottom: 2px solid #F97316;
          margin-bottom: 10px;
        }
        body::after {
          content: "Proximité Habitat Conseil · Exporté le ${dateStr}";
          display: block;
          font-size: 9px;
          color: #9ca3af;
          text-align: right;
          margin-top: 12px;
          padding-top: 6px;
          border-top: 1px solid #e5e7eb;
        }

        /* ── Reset global ── */
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        html, body { background: white !important; font-family: sans-serif; }

        /* ── Éléments UI à masquer ── */
        header, nav, aside, footer,
        button:not([data-pdf-keep]),
        [role="navigation"],
        .no-print { display: none !important; }

        /* ── Mise en page : 1 seule page A4 ── */
        @page {
          size: A4 portrait;
          margin: 8mm 10mm 10mm 10mm;
        }

        /* Réduire l'échelle du contenu pour tenir sur 1 page */
        main {
          padding: 0 !important;
          margin: 0 !important;
          zoom: 0.62;
          -webkit-print-color-adjust: exact !important;
        }

        /* Supprimer les espacements excessifs */
        .space-y-6 > * + * { margin-top: 8px !important; }
        .space-y-4 > * + * { margin-top: 6px !important; }
        .space-y-3 > * + * { margin-top: 4px !important; }
        .space-y-2 > * + * { margin-top: 3px !important; }
        .gap-4 { gap: 6px !important; }
        .gap-6 { gap: 8px !important; }
        .p-6, .p-8 { padding: 8px !important; }
        .p-4, .p-5 { padding: 6px !important; }
        .py-6, .py-8 { padding-top: 6px !important; padding-bottom: 6px !important; }
        .px-6, .px-8 { padding-left: 6px !important; padding-right: 6px !important; }

        /* Textes plus compacts */
        body { font-size: 9px; line-height: 1.3; }
        h1 { font-size: 13px !important; }
        h2 { font-size: 11px !important; }
        h3 { font-size: 10px !important; }
        p { font-size: 9px !important; margin: 2px 0 !important; }

        /* Cards */
        .rounded-2xl, .rounded-xl {
          border-radius: 3px !important;
          border: 1px solid #e5e7eb !important;
          box-shadow: none !important;
        }
        .shadow-sm, .shadow, .shadow-md { box-shadow: none !important; }

        /* Tableaux */
        table { border-collapse: collapse; width: 100%; font-size: 8px; }
        th, td { border: 1px solid #e5e7eb; padding: 3px 5px; text-align: left; }
        th { background: #f1f5f9 !important; font-weight: 600; }
        tr:nth-child(even) td { background: #f9fafb !important; }

        /* Badges */
        .badge, [class*="badge"] { border: 1px solid currentColor !important; font-size: 8px !important; padding: 1px 4px !important; }

        /* Couleurs */
        .text-muted-foreground { color: #6b7280 !important; }
        .text-foreground { color: #111827 !important; }

        /* Graphiques recharts */
        .recharts-wrapper { page-break-inside: avoid; max-height: 180px !important; }

        /* Éviter les coupures dans les blocs */
        .rounded-xl, .rounded-2xl, .card { page-break-inside: avoid; }

        /* Empêcher les débordements de page */
        main > * { page-break-inside: avoid; }
        .overflow-y-auto, .overflow-auto { overflow: visible !important; max-height: none !important; }

        ${printLayout === "3col" ? `
        /* ── Mode 3 colonnes (fiche détail) — A4 paysage ── */

        /* Paysage pour disposer 3 colonnes */
        @page { size: A4 landscape !important; margin: 6mm 8mm !important; }

        /* Annuler le zoom portrait et réajuster pour paysage */
        main { zoom: 0.78 !important; }

        /* Masquer : bannière validation, barre bas de page, boutons d'action */
        [data-no-print] { display: none !important; }

        /* Masquer les photos (trop volumineuses) */
        [data-pdf-photos] { display: none !important; }

        /* ── Transformer le grid 2-col en CSS columns 3 ── */
        .lg\\:grid-cols-3 {
          display: block !important;
          column-count: 3 !important;
          column-gap: 8px !important;
          column-fill: balance !important;
        }

        /* Les 2 wrappers (main + sidebar) deviennent transparents
           → leurs enfants directs flottent dans les 3 colonnes */
        .lg\\:col-span-2,
        .lg\\:grid-cols-3 > div:last-child {
          display: contents !important;
        }

        /* Le wrapper Ventilation+Isolation (grid 2-col interne) → transparent aussi */
        .sm\\:grid-cols-2 {
          display: contents !important;
        }

        /* Chaque SectionCard = 1 item de colonne, sans coupure */
        .lg\\:grid-cols-3 > .lg\\:col-span-2 ~ *,
        .lg\\:grid-cols-3 .bg-card {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          display: block !important;
          margin-bottom: 5px !important;
        }

        /* Espacements internes des cards réduits */
        .lg\\:grid-cols-3 .space-y-4 > * + * { margin-top: 4px !important; }
        .lg\\:grid-cols-3 .space-y-3 > * + * { margin-top: 3px !important; }
        .lg\\:grid-cols-3 .space-y-2 > * + * { margin-top: 2px !important; }

        /* Historique : limiter à 5 entrées visibles */
        .lg\\:grid-cols-3 [class*="relative pl-6"]:nth-child(n+6) { display: none !important; }
        ` : ""}
      }
    `;

    const prevTitle = document.title;
    if (filename) document.title = filename;

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (filename) document.title = prevTitle;
        setLoading(false);
      }, 500);
    }, 100);
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handlePrint}
      disabled={loading}
      className={`gap-2 ${className ?? ""}`}
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <FileDown className="w-4 h-4" />
      }
      Exporter PDF
    </Button>
  );
}
