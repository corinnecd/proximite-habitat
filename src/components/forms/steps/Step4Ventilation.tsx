"use client";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SYSTEMES_VENTILATION } from "@/lib/validations/fiche";
import type { FicheFormData } from "@/lib/validations/fiche";
import { Wind } from "lucide-react";

export function Step4Ventilation() {
  const { register, setValue, watch } = useFormContext<FicheFormData>();
  const selected = watch("systemes_ventilation") || [];
  const toggle = (o: string) => setValue("systemes_ventilation", selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o], { shouldDirty: true });
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center"><Wind className="w-5 h-5 text-sky-600" /></div><div><h3 className="font-heading text-xl">Ventilation</h3><p className="text-sm text-muted-foreground">Système en place</p></div></div>
      <div className="space-y-3"><Label>Système de ventilation</Label><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{SYSTEMES_VENTILATION.map((o) => (<label key={o} className={`flex items-center gap-3 px-4 py-4 rounded-xl border cursor-pointer transition-all ${selected.includes(o) ? "bg-primary/5 border-primary text-primary" : "bg-white border-border hover:border-primary/30"}`}><Checkbox checked={selected.includes(o)} onCheckedChange={() => toggle(o)} /><span className="text-sm font-medium">{o}</span></label>))}</div></div>
      <div className="space-y-2"><Label>Âge du système</Label><Input placeholder="10 ans" className="h-12 bg-white" {...register("age_ventilation")} /></div>
    </div>
  );
}
