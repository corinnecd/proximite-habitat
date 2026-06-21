"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import type { Fiche } from "@/types/database";

interface Props {
  fiche: Fiche;
  referentNom: string;
  commercialNom?: string;
  photoUrls?: string[];
  orgName?: string;
}

export function DownloadFicheButton({ fiche, referentNom, commercialNom, photoUrls, orgName }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      // Import dynamique pour ne pas embarquer react-pdf dans le bundle SSR
      const { pdf } = await import("@react-pdf/renderer");
      const { FichePDF } = await import("./FichePDF");
      const { createElement } = await import("react");

      const element = createElement(FichePDF, { fiche, referentNom, commercialNom, photoUrls, orgName });
      // react-pdf renderer attend un ReactElement — le cast est nécessaire car ses types internes divergent de React 18
      const blob = await pdf(element as Parameters<typeof pdf>[0]).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fiche.reference}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PDF generation error:", e);
      const { toast } = await import("sonner");
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleDownload}
      disabled={loading}
      className="rounded-xl gap-2"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {loading ? "Génération…" : "Exporter PDF"}
    </Button>
  );
}
