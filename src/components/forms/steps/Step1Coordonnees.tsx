"use client";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JOURS_DISPONIBILITES } from "@/lib/validations/fiche";
import type { FicheFormData } from "@/lib/validations/fiche";
import { User, MapPin, Phone, Calendar } from "lucide-react";

export function Step1Coordonnees() {
  const { register, formState: { errors }, setValue, watch } = useFormContext<FicheFormData>();
  const disponibilites = watch("disponibilites") || [];
  function toggleJour(jour: string) {
    const updated = disponibilites.includes(jour) ? disponibilites.filter((j) => j !== jour) : [...disponibilites, jour];
    setValue("disponibilites", updated, { shouldDirty: true });
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><User className="w-5 h-5 text-primary" /></div><div><h3 className="font-heading text-xl">Coordonnées du prospect</h3><p className="text-sm text-muted-foreground">Informations de contact</p></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2"><Label>Nom *</Label><Input placeholder="Dupont" className="h-12 bg-white" {...register("prospect_nom")} />{errors.prospect_nom && <p className="text-sm text-destructive">{errors.prospect_nom.message}</p>}</div>
        <div className="space-y-2"><Label>Prénom *</Label><Input placeholder="Jean" className="h-12 bg-white" {...register("prospect_prenom")} />{errors.prospect_prenom && <p className="text-sm text-destructive">{errors.prospect_prenom.message}</p>}</div>
      </div>
      <div className="space-y-2"><Label className="flex items-center gap-2"><MapPin className="w-4 h-4" />Adresse *</Label><Input placeholder="12 rue de la Paix" className="h-12 bg-white" {...register("prospect_adresse")} />{errors.prospect_adresse && <p className="text-sm text-destructive">{errors.prospect_adresse.message}</p>}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2"><Label>Code postal *</Label><Input placeholder="75001" maxLength={5} className="h-12 bg-white" {...register("prospect_cp")} />{errors.prospect_cp && <p className="text-sm text-destructive">{errors.prospect_cp.message}</p>}</div>
        <div className="space-y-2"><Label>Ville *</Label><Input placeholder="Paris" className="h-12 bg-white" {...register("prospect_ville")} />{errors.prospect_ville && <p className="text-sm text-destructive">{errors.prospect_ville.message}</p>}</div>
      </div>
      <div className="space-y-2"><Label className="flex items-center gap-2"><Phone className="w-4 h-4" />Téléphone *</Label><Input placeholder="06 12 34 56 78" className="h-12 bg-white" {...register("prospect_telephone")} />{errors.prospect_telephone && <p className="text-sm text-destructive">{errors.prospect_telephone.message}</p>}</div>
      <div className="space-y-3"><Label className="flex items-center gap-2"><Calendar className="w-4 h-4" />Disponibilités</Label><div className="flex flex-wrap gap-3">{JOURS_DISPONIBILITES.map((j) => (<button key={j} type="button" onClick={() => toggleJour(j)} className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${disponibilites.includes(j) ? "bg-primary text-white border-primary" : "bg-white border-border hover:border-primary/50"}`}>{j}</button>))}</div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2"><Label>Date de visite</Label><Input type="date" className="h-12 bg-white" {...register("date_visite")} /></div>
        <div className="space-y-2"><Label>Heure souhaitée</Label><Input type="time" className="h-12 bg-white" {...register("heure_visite")} /></div>
      </div>
    </div>
  );
}
