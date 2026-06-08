"use client";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FicheFormData } from "@/lib/validations/fiche";
import { Home } from "lucide-react";

export function Step2Habitation() {
  const { register, setValue, watch } = useFormContext<FicheFormData>();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Home className="w-5 h-5 text-primary" /></div><div><h3 className="font-heading text-xl">Caractéristiques de l&apos;habitation</h3><p className="text-sm text-muted-foreground">Informations sur le logement</p></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2"><Label>Année de construction</Label><Input type="number" placeholder="1985" className="h-12 bg-card" {...register("annee_construction", { valueAsNumber: true })} /></div>
        <div className="space-y-2"><Label>Année d&apos;emménagement</Label><Input type="number" placeholder="2010" className="h-12 bg-card" {...register("annee_emmenagement", { valueAsNumber: true })} /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2"><Label>Température de confort (°C)</Label><Input type="number" step="0.5" placeholder="20" className="h-12 bg-card" {...register("temperature_confort", { valueAsNumber: true })} /></div>
        <div className="space-y-2"><Label>Surface totale chauffée (m²)</Label><Input type="number" placeholder="120" className="h-12 bg-card" {...register("surface_chauffee", { valueAsNumber: true })} /></div>
      </div>
      <div className="space-y-2"><Label>Nombre d&apos;habitants permanents</Label><div className="flex flex-wrap gap-3">{[1,2,3,4,5,6,7,8].map((n) => (<button key={n} type="button" onClick={() => setValue("nb_habitants", n, { shouldDirty: true })} className={`w-12 h-12 rounded-xl border text-sm font-medium transition-all ${watch("nb_habitants") === n ? "bg-primary text-white border-primary" : "bg-card border-border hover:border-primary/50"}`}>{n}</button>))}</div></div>
      <div className="space-y-3"><Label>Maison en vente ?</Label><div className="flex gap-4">
        <button type="button" onClick={() => setValue("maison_en_vente", true, { shouldDirty: true })} className={`flex-1 h-14 rounded-xl border text-sm font-medium transition-all ${watch("maison_en_vente") === true ? "bg-primary text-white border-primary" : "bg-card border-border"}`}>OUI</button>
        <button type="button" onClick={() => setValue("maison_en_vente", false, { shouldDirty: true })} className={`flex-1 h-14 rounded-xl border text-sm font-medium transition-all ${watch("maison_en_vente") === false ? "bg-primary text-white border-primary" : "bg-card border-border"}`}>NON</button>
      </div></div>
    </div>
  );
}
