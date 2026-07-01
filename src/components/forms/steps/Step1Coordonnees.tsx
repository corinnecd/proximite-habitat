"use client";
import { useEffect, useState, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JOURS_DISPONIBILITES } from "@/lib/validations/fiche";
import type { FicheFormData } from "@/lib/validations/fiche";
import { createClient } from "@/lib/supabase/client";
import { findDuplicateFiches, type DuplicateFiche } from "@/lib/data/fiches";
import { STATUS_LABELS } from "@/lib/permissions";
import { useProfile } from "@/lib/hooks/use-profile";
import { VilleMapDynamic } from "@/components/ui/VilleMapDynamic";
import { Autocomplete } from "@/components/ui/autocomplete";
import { User, MapPin, Phone, Mail, Calendar, AlertTriangle, Users, Map } from "lucide-react";
import type { ZoneDepartement, ZoneVille } from "@/types/database";

export function Step1Coordonnees({ currentFicheId }: { currentFicheId?: string }) {
  const { register, formState: { errors }, setValue, watch } = useFormContext<FicheFormData>();
  const { profile } = useProfile();
  const supabase = useMemo(() => createClient(), []);
  const disponibilites = watch("disponibilites") || [];

  function toggleJour(jour: string) {
    const updated = disponibilites.includes(jour) ? disponibilites.filter((j) => j !== jour) : [...disponibilites, jour];
    setValue("disponibilites", updated, { shouldDirty: true });
  }

  // Départements & villes
  const [departements, setDepartements] = useState<ZoneDepartement[]>([]);
  const [villes, setVilles] = useState<ZoneVille[]>([]);
  const [planifiedVilleIds, setPlanifiedVilleIds] = useState<Set<string>>(new Set());

  const selectedDept = watch("departement_code");
  const selectedVilleId = watch("ville_id");

  const selectedVille = villes.find((v) => v.id === selectedVilleId);

  useEffect(() => {
    supabase.from("zones_departements").select("*").order("code").then(({ data }) => {
      if (data) setDepartements(data);
    });
  }, [supabase]);

  useEffect(() => {
    if (!selectedDept) { setVilles([]); return; }
    supabase.from("zones_villes").select("*").eq("departement_code", selectedDept).order("nom").then(({ data }) => {
      if (data) setVilles(data);
    });
  }, [selectedDept, supabase]);

  // Charger les villes planifiées pour la semaine en cours
  useEffect(() => {
    if (!profile) return;
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

    const chefId = profile.role === "CHEF_EQUIPE" ? profile.id : profile.chef_equipe_id;
    let query = supabase
      .from("planification_hebdo")
      .select("ville_id")
      .eq("semaine_du", mondayStr)
      .eq("organization_id", profile.organization_id);
    if (chefId) {
      query = query.or(`chef_equipe_id.eq.${chefId},chef_equipe_id.is.null`);
    }
    query.then(({ data }) => {
      if (data) setPlanifiedVilleIds(new Set(data.map((d) => d.ville_id)));
    });
  }, [profile, supabase]);

  const filteredVilles = villes.filter((v) => planifiedVilleIds.size === 0 || planifiedVilleIds.has(v.id));

  function handleDeptChange(code: string) {
    setValue("departement_code", code || "", { shouldDirty: true, shouldValidate: true });
    setValue("ville_id", "", { shouldDirty: true, shouldValidate: true });
    setValue("prospect_ville", "", { shouldDirty: true });
    setValue("prospect_cp", "", { shouldDirty: true });
  }

  function handleVilleChange(villeId: string) {
    const ville = villes.find((v) => v.id === villeId);
    setValue("ville_id", villeId || "", { shouldDirty: true, shouldValidate: true });
    if (ville) {
      setValue("prospect_ville", ville.nom, { shouldDirty: true });
      setValue("prospect_cp", ville.code_postal, { shouldDirty: true });
    }
  }

  // Détection de doublons
  const nom = watch("prospect_nom");
  const cp = watch("prospect_cp");
  const telephone = watch("prospect_telephone");
  const [duplicates, setDuplicates] = useState<DuplicateFiche[]>([]);

  useEffect(() => {
    const hasNomCp = (nom?.trim().length ?? 0) >= 2 && (cp?.trim().length ?? 0) >= 4;
    const hasTel = (telephone?.replace(/\s+/g, "").length ?? 0) >= 6;
    if (!hasNomCp && !hasTel) {
      setDuplicates([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await findDuplicateFiches(supabase, { nom, cp, telephone, excludeId: currentFicheId });
      if (!cancelled) setDuplicates(found);
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [nom, cp, telephone, currentFicheId, supabase]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><User className="w-5 h-5 text-primary" /></div><div><h3 className="font-heading text-xl font-semibold tracking-tight">Coordonnées du prospect</h3><p className="text-sm text-muted-foreground">Informations de contact</p></div></div>

      {duplicates.length > 0 && (
        <div role="alert" className="rounded-xl border border-orange-300 bg-orange-50 dark:bg-orange-950/30 p-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {duplicates.length === 1 ? "Une fiche existe déjà" : `${duplicates.length} fiches existent déjà`} pour ce prospect
          </p>
          <ul className="space-y-1">
            {duplicates.map((d) => (
              <li key={d.id} className="text-sm">
                <Link href={`/fiches/${d.id}`} target="_blank" className="text-orange-800 dark:text-orange-200 underline underline-offset-2 hover:text-orange-900">
                  {d.prospect_prenom} {d.prospect_nom}
                </Link>
                <span className="text-orange-700/70 dark:text-orange-300/70">
                  {" "}— {d.reference}{d.prospect_ville ? ` · ${d.prospect_ville}` : ""} · {STATUS_LABELS[d.status]}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-orange-700/70 dark:text-orange-300/70">Vérifiez qu&apos;il ne s&apos;agit pas d&apos;un doublon avant de poursuivre.</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label>Nom *</Label>
          <Input placeholder="Dupont" className="h-12 bg-card" aria-invalid={!!errors.prospect_nom} {...register("prospect_nom")} />
          {errors.prospect_nom && <p className="text-xs text-destructive flex items-center gap-1"><span>⚠</span>{errors.prospect_nom.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Prénom *</Label>
          <Input placeholder="Jean" className="h-12 bg-card" aria-invalid={!!errors.prospect_prenom} {...register("prospect_prenom")} />
          {errors.prospect_prenom && <p className="text-xs text-destructive flex items-center gap-1"><span>⚠</span>{errors.prospect_prenom.message}</p>}
        </div>
      </div>

      {/* Département & Ville */}
      <div className="border border-border rounded-2xl p-4 space-y-4 bg-card/50">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Map className="w-4 h-4" />
          Zone de prospection *
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Département *</Label>
            <Autocomplete
              options={departements.map((d) => ({ value: d.code, label: `${d.code} — ${d.nom}` }))}
              value={selectedDept || ""}
              onChange={handleDeptChange}
              placeholder="Rechercher un département…"
            />
            {errors.departement_code && <p className="text-xs text-destructive flex items-center gap-1"><span>⚠</span>{errors.departement_code.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Ville * {planifiedVilleIds.size > 0 && <span className="text-xs text-muted-foreground font-normal">(planifiée cette semaine)</span>}</Label>
            <Autocomplete
              options={filteredVilles.map((v) => ({ value: v.id, label: v.nom, sublabel: v.code_postal }))}
              value={selectedVilleId || ""}
              onChange={handleVilleChange}
              placeholder={selectedDept ? "Rechercher une ville…" : "Choisir un département d'abord"}
              disabled={!selectedDept}
            />
            {errors.ville_id && <p className="text-xs text-destructive flex items-center gap-1"><span>⚠</span>{errors.ville_id.message}</p>}
          </div>
        </div>
        {selectedVille && (
          <VilleMapDynamic lat={selectedVille.lat} lng={selectedVille.lng} villeNom={selectedVille.nom} />
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2"><MapPin className="w-4 h-4" />Adresse *</Label>
        <Input placeholder="12 rue de la Paix" className="h-12 bg-card" aria-invalid={!!errors.prospect_adresse} {...register("prospect_adresse")} />
        {errors.prospect_adresse && <p className="text-xs text-destructive flex items-center gap-1"><span>⚠</span>{errors.prospect_adresse.message}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label>Code postal</Label>
          <Input placeholder="75001" maxLength={5} className="h-12 bg-card" aria-invalid={!!errors.prospect_cp} {...register("prospect_cp")} />
          {errors.prospect_cp && <p className="text-xs text-destructive flex items-center gap-1"><span>⚠</span>{errors.prospect_cp.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Ville</Label>
          <Input placeholder="Paris" className="h-12 bg-card" aria-invalid={!!errors.prospect_ville} {...register("prospect_ville")} />
          {errors.prospect_ville && <p className="text-xs text-destructive flex items-center gap-1"><span>⚠</span>{errors.prospect_ville.message}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Phone className="w-4 h-4" />Téléphone *</Label>
        <Input placeholder="06 12 34 56 78" className="h-12 bg-card" aria-invalid={!!errors.prospect_telephone} {...register("prospect_telephone")} />
        {errors.prospect_telephone && <p className="text-xs text-destructive flex items-center gap-1"><span>⚠</span>{errors.prospect_telephone.message}</p>}
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Mail className="w-4 h-4" />Adresse email</Label>
        <Input type="email" placeholder="client@email.fr" className="h-12 bg-card" aria-invalid={!!errors.prospect_email} {...register("prospect_email")} />
        {errors.prospect_email && <p className="text-xs text-destructive flex items-center gap-1"><span>⚠</span>{errors.prospect_email.message}</p>}
      </div>
      <div className="space-y-3"><Label className="flex items-center gap-2"><Calendar className="w-4 h-4" />Disponibilités</Label><div className="flex flex-wrap gap-3">{JOURS_DISPONIBILITES.map((j) => (<button key={j} type="button" onClick={() => toggleJour(j)} className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${disponibilites.includes(j) ? "bg-primary text-white border-primary" : "bg-card border-border hover:border-primary/50"}`}>{j}</button>))}</div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2"><Label>Date de visite</Label><Input type="date" className="h-12 bg-card" onKeyDown={(e) => e.preventDefault()} {...register("date_visite", { onChange: (e) => (e.target as HTMLInputElement).blur() })} /></div>
        <div className="space-y-2"><Label>Heure souhaitée</Label><Input type="time" className="h-12 bg-card" {...register("heure_visite")} /></div>
      </div>

      {/* ── Rendez-vous & Référent habitant ── */}
      <div className="border-t border-border pt-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Calendar className="w-4 h-4" />
          Rendez-vous &amp; Référent
        </div>
        <div className="space-y-2">
          <Label>Rendez-vous pris le</Label>
          <Input type="date" className="h-12 bg-card" onKeyDown={(e) => e.preventDefault()} {...register("rdv_date", { onChange: (e) => (e.target as HTMLInputElement).blur() })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Users className="w-4 h-4" />Nom du référent habitant</Label>
            <Input placeholder="Ex. : Marie Dupont" className="h-12 bg-card" {...register("referent_nom")} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Phone className="w-4 h-4" />Numéro référent</Label>
            <Input placeholder="06 12 34 56 78" className="h-12 bg-card" {...register("referent_telephone")} />
          </div>
        </div>
      </div>
    </div>
  );
}
