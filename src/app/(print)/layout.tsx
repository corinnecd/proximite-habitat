import "@/app/globals.css";

/** Layout minimal pour les pages d'impression — aucun sidebar ni topbar */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="print-root">{children}</div>;
}
