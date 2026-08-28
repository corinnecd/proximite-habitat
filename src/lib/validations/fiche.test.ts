import { describe, it, expect } from "vitest";
import { step1Schema, step7Schema } from "./fiche";

// Le fixture doit couvrir TOUS les champs requis par step1Schema. Il était resté
// à une version antérieure du schéma : departement_code, ville_id et date_visite
// sont devenus obligatoires, et `disponibilites` exige au moins une entrée — les
// deux cas nominaux échouaient donc pour une raison sans rapport avec leur objet.
const validStep1 = {
  prospect_nom: "Dupont",
  prospect_prenom: "Jean",
  prospect_adresse: "12 rue de la Paix",
  prospect_cp: "69001",
  prospect_ville: "Lyon",
  departement_code: "69",
  ville_id: "11111111-1111-1111-1111-111111111111",
  prospect_telephone: "06 12 34 56 78",
  disponibilites: ["LU"],
  date_visite: "2026-09-01",
};

describe("step1Schema", () => {
  it("accepte des coordonnées valides", () => {
    expect(step1Schema.safeParse(validStep1).success).toBe(true);
  });

  it("rejette un code postal non à 5 chiffres", () => {
    const r = step1Schema.safeParse({ ...validStep1, prospect_cp: "690" });
    expect(r.success).toBe(false);
  });

  it("rejette un numéro de téléphone invalide", () => {
    const r = step1Schema.safeParse({ ...validStep1, prospect_telephone: "123" });
    expect(r.success).toBe(false);
  });

  it("accepte le format +33", () => {
    const r = step1Schema.safeParse({ ...validStep1, prospect_telephone: "+33 6 12 34 56 78" });
    expect(r.success).toBe(true);
  });

  it("rejette un nom vide", () => {
    const r = step1Schema.safeParse({ ...validStep1, prospect_nom: "" });
    expect(r.success).toBe(false);
  });
});

describe("step7Schema (consentement RGPD)", () => {
  it("exige le consentement à true", () => {
    expect(step7Schema.safeParse({ consentement_rgpd: true }).success).toBe(true);
    expect(step7Schema.safeParse({ consentement_rgpd: false }).success).toBe(false);
  });
});
