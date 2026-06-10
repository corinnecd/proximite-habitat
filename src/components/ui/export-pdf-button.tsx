"use client";

import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ExportPdfButtonProps {
  /** Titre affiché en en-tête du PDF */
  title: string;
  /** Sous-titre optionnel (ex : période, filtres actifs) */
  subtitle?: string;
  /** Sélecteur CSS de la zone à imprimer. Par défaut : `main` */
  contentSelector?: string;
  /** Nom du fichier suggéré (sans extension) */
  filename?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportPdfButton({
  title,
  subtitle,
  contentSelector = "main",
  filename,
  className,
  variant = "outline",
  size = "sm",
}: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false);

  function handlePrint() {
    setLoading(true);

    // Injecte une feuille de style d'impression temporaire
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

    style.textContent = `
      @media print {
        /* Masquer tout sauf le contenu principal */
        body > * { display: none !important; }
        body > * > * > main,
        #__next main,
        [data-pdf-content] { display: block !important; }

        /* En-tête PDF */
        body::before {
          content: "${title.replace(/"/g, "'")}${subtitle ? " — " + subtitle.replace(/"/g, "'") : ""}";
          display: block;
          font-size: 18px;
          font-weight: 700;
          color: #1E3A5F;
          padding-bottom: 8px;
          border-bottom: 2px solid #F97316;
          margin-bottom: 16px;
        }
        body::after {
          content: "Proximité Habitat Conseil · Exporté le ${dateStr}";
          display: block;
          font-size: 10px;
          color: #9ca3af;
          text-align: right;
          margin-top: 24px;
          padding-top: 8px;
          border-top: 1px solid #e5e7eb;
        }

        /* Reset général */
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { background: white !important; font-family: sans-serif; font-size: 11px; }

        /* Masquer les éléments non pertinents */
        header, nav, aside, footer,
        button:not([data-pdf-keep]),
        [role="navigation"],
        .no-print { display: none !important; }

        /* Mise en page */
        @page { margin: 15mm 12mm; size: A4 portrait; }
        main { padding: 0 !important; }

        /* Tableaux */
        table { border-collapse: collapse; width: 100%; font-size: 10px; }
        th, td { border: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; }
        th { background: #f1f5f9 !important; font-weight: 600; }
        tr:nth-child(even) td { background: #f9fafb !important; }

        /* Cards → tableau-like */
        .rounded-2xl, .rounded-xl { border-radius: 4px !important; border: 1px solid #e5e7eb !important; box-shadow: none !important; }
        .shadow-sm, .shadow { box-shadow: none !important; }

        /* Couleurs de texte */
        .text-muted-foreground { color: #6b7280 !important; }
        .text-foreground { color: #111827 !important; }

        /* Badges */
        .badge, [class*="badge"] { border: 1px solid currentColor !important; }

        /* Graphiques recharts : conserver */
        .recharts-wrapper { page-break-inside: avoid; }
      }
    `;

    // Optionnel : titre de page navigateur
    const prevTitle = document.title;
    if (filename) document.title = filename;

    setTimeout(() => {
      window.print();
      // Nettoyage après fermeture du dialogue d'impression
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
