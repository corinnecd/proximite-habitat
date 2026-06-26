"use client";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { NATURE_ISOLANT, TYPES_POSE_TOITURE, MATERIAUX_TOITURE } from "@/lib/validations/fiche";
import type { FicheFormData } from "@/lib/validations/fiche";
import { Shield, HardHat } from "lucide-react";

function Multi({ label, options, field }: { label: string; options: readonly string[]; field: keyof FicheFormData }) {
  const { setValue, watch } = useFormContext<FicheFormData>();
  const selected = (watch(field) as string[]) || [];
  const toggle = (o: string) => setValue(field, (selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]) as never, { shouldDirty: true });
  return (<div className="space-y-3"><Label>{label}</Label><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{options.map((o) => (<label key={o} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${selected.includes(o) ? "bg-primary/5 border-primary text-primary" : "bg-card border-border hover:border-primary/30"}`}><Checkbox checked={selected.includes(o)} onCheckedChange={() => toggle(o)} /><span className="text-sm">{o}</span></label>))}</div></div>);
}

export function Step5Isolation() {
  const { register } = useFormContext<FicheFormData>();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><Shield className="w-5 h-5 text-green-600" /></div><div><h3 className="font-heading text-xl font-semibold tracking-tight">Isolation</h3><p className="text-sm text-muted-foreground">Nature et état</p></div></div>
      <Multi label="Nature de l'isolant" options={NATURE_ISOLANT} field="nature_isolant" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2"><Label>Âge</Label><Input placeholder="15 ans" className="h-12 bg-card" {...register("age_isolant")} /></div>
        <div className="space-y-2"><Label>Épaisseur</Label><Input placeholder="200 mm" className="h-12 bg-card" {...register("epaisseur_isolant")} /></div>
      </div>
      <div className="flex items-center gap-3 mt-8 mb-4"><div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><HardHat className="w-5 h-5 text-amber-600" /></div><div><h3 className="font-heading text-xl font-semibold tracking-tight">Toiture</h3><p className="text-sm text-muted-foreground">Type de pose et matériaux</p></div></div>
      <Multi label="Type de pose" options={TYPES_POSE_TOITURE} field="types_pose_toiture" />
      <Multi label="Matériaux" options={MATERIAUX_TOITURE} field="materiaux_toiture" />
    </div>
  );
}
