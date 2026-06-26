"use client";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MODES_CHAUFFAGE, SYSTEMES_CHAUFFAGE } from "@/lib/validations/fiche";
import type { FicheFormData } from "@/lib/validations/fiche";
import { Flame } from "lucide-react";

function CheckGroup({ label, options, field }: { label: string; options: readonly string[]; field: "modes_chauffage" | "systemes_chauffage" }) {
  const { setValue, watch } = useFormContext<FicheFormData>();
  const selected = watch(field) || [];
  const toggle = (o: string) => setValue(field, selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o], { shouldDirty: true });
  return (<div className="space-y-3"><Label>{label}</Label><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{options.map((o) => (<label key={o} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${selected.includes(o) ? "bg-primary/5 border-primary text-primary" : "bg-card border-border hover:border-primary/30"}`}><Checkbox checked={selected.includes(o)} onCheckedChange={() => toggle(o)} /><span className="text-sm">{o}</span></label>))}</div></div>);
}

export function Step3Chauffage() {
  const { register } = useFormContext<FicheFormData>();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><Flame className="w-5 h-5 text-orange-600" /></div><div><h3 className="font-heading text-xl font-semibold tracking-tight">Chauffage</h3><p className="text-sm text-muted-foreground">Mode et système actuels</p></div></div>
      <CheckGroup label="Mode de chauffage" options={MODES_CHAUFFAGE} field="modes_chauffage" />
      <CheckGroup label="Système de chauffage" options={SYSTEMES_CHAUFFAGE} field="systemes_chauffage" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2"><Label>Consommation annuelle</Label><Input placeholder="15 000 kWh" className="h-12 bg-card" {...register("consommation")} /></div>
        <div className="space-y-2"><Label>Coût annuel (€)</Label><Input type="number" placeholder="1 500" className="h-12 bg-card" {...register("cout_annuel", { valueAsNumber: true })} /></div>
      </div>
    </div>
  );
}
