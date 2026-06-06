"use client";
import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FicheFormData } from "@/lib/validations/fiche";
import { Camera, X, ImageIcon, CloudCheck } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

export interface UploadedPhoto {
  id: string;
  url: string;
  original_name: string;
  storage_path: string;
}

interface Step6Props {
  photos: File[];
  setPhotos: (p: File[]) => void;
  /** Photos déjà persistées en base / storage */
  uploadedPhotos?: UploadedPhoto[];
  onRemoveUploaded?: (id: string) => void;
  /** Remplace setPhotos pour gérer l'upload immédiat côté stepper */
  onAddValidFiles?: (files: File[]) => Promise<void>;
}

export function Step6Photos({
  photos,
  setPhotos,
  uploadedPhotos = [],
  onRemoveUploaded,
  onAddValidFiles,
}: Step6Props) {
  const { register } = useFormContext<FicheFormData>();

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const valid: File[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} dépasse 5 Mo`); continue; }
        if (!f.type.startsWith("image/")) { toast.error(`${f.name} n'est pas une image`); continue; }
        valid.push(f);
      }
      if (valid.length === 0) return;
      if (onAddValidFiles) {
        await onAddValidFiles(valid);
      } else {
        setPhotos([...photos, ...valid]);
      }
    },
    [photos, setPhotos, onAddValidFiles]
  );

  const totalCount = uploadedPhotos.length + photos.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <Camera className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h3 className="font-heading text-xl">Photos & Observations</h3>
          <p className="text-sm text-muted-foreground">Photos et notes du logement</p>
        </div>
      </div>

      {/* Zone de dépôt */}
      <div className="space-y-3">
        <Label>Photos du logement {totalCount > 0 && `(${totalCount})`}</Label>
        <div
          className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-white"
          onClick={() => document.getElementById("photo-input")?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        >
          <ImageIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Glissez vos photos ici ou <span className="text-primary font-medium">parcourir</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">Max 5 Mo par photo · JPG, PNG, WEBP</p>
          <input
            id="photo-input"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* Photos déjà sauvegardées en storage */}
        {uploadedPhotos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CloudCheck className="w-3.5 h-3.5 text-green-500" />
              Photos sauvegardées ({uploadedPhotos.length})
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {uploadedPhotos.map((p) => (
                <div key={p.id} className="relative group rounded-xl overflow-hidden ring-1 ring-green-200">
                  <img src={p.url} alt={p.original_name} className="w-full h-32 object-cover" />
                  {onRemoveUploaded && (
                    <button
                      type="button"
                      onClick={() => onRemoveUploaded(p.id)}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photos locales en attente d'upload */}
        {photos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">En attente de sauvegarde ({photos.length})</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((p, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden ring-1 ring-orange-200">
                  <img src={URL.createObjectURL(p)} alt={p.name} className="w-full h-32 object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Notes / Observations</Label>
        <Textarea
          placeholder="Observations sur le logement..."
          className="min-h-[150px] bg-white"
          {...register("observations")}
        />
      </div>
    </div>
  );
}
