"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toCsv, downloadCsv, type CsvColumn } from "@/lib/csv";

interface ExportCsvButtonProps {
  filename?: string;
  getData: () => { columns: CsvColumn<Record<string, unknown>>[]; rows: Record<string, unknown>[] };
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default" | "icon";
  className?: string;
}

export function ExportCsvButton({
  filename = "export",
  getData,
  variant = "outline",
  size = "sm",
  className,
}: ExportCsvButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = () => {
    setLoading(true);
    try {
      const { columns, rows } = getData();
      const csv = toCsv(columns, rows);
      downloadCsv(`${filename}.csv`, csv);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleExport} disabled={loading} data-no-print>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      <span className="ml-1.5">CSV</span>
    </Button>
  );
}
