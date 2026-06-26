"use client";
import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SignatureCanvas } from "../SignatureCanvas";
import type { FicheFormData } from "@/lib/validations/fiche";
import { PenTool, ShieldCheck } from "lucide-react";
import Image from "next/image";

interface Step7Props {
  signatureDataUrl: string | null;
  setSignatureDataUrl: (url: string | null) => void;
  existingSignatureUrl?: string | null;
}

export function Step7Signature({ setSignatureDataUrl, existingSignatureUrl }: Step7Props) {
  const { setValue, watch, formState: { errors } } = useFormContext<FicheFormData>();
  const consentement = watch("consentement_rgpd");
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><PenTool className="w-5 h-5 text-emerald-600" /></div><div><h3 className="font-heading text-xl font-semibold tracking-tight">Signature & Validation</h3><p className="text-sm text-muted-foreground">Signature et consentement RGPD</p></div></div>
      <div className="space-y-3">
        <Label>Signature du prospect <span className="text-destructive">*</span></Label>
        {existingSignatureUrl && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Signature existante (conservée si vous ne re-signez pas)</p>
            <Image src={existingSignatureUrl} alt="Signature existante" width={400} height={120} className="max-h-24 w-auto object-contain rounded-lg border border-border bg-white" unoptimized />
          </div>
        )}
        <SignatureCanvas onSignatureChange={setSignatureDataUrl} />
      </div>
      <div className="bg-blue-50 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3"><ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" /><div><p className="text-sm font-medium text-blue-900">Consentement RGPD</p><p className="text-xs text-blue-700 mt-1">Les données collectées sont nécessaires au traitement de votre demande de pré-visite et ne seront pas transmises à des tiers sans accord.</p></div></div>
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={consentement === true} onCheckedChange={(c) => setValue("consentement_rgpd", c === true ? true : (false as unknown as true), { shouldDirty: true, shouldValidate: true })} className="mt-0.5" />
          <span className="text-sm text-blue-800">J&apos;accepte que mes données personnelles soient collectées et traitées. *</span>
        </label>
        {errors.consentement_rgpd && <p className="text-sm text-destructive">{errors.consentement_rgpd.message}</p>}
      </div>
    </div>
  );
}
