import { describe, it, expect } from "vitest";
import {
  canTransition,
  getAvailableTransitions,
  canManageUsers,
  canAssignFiche,
  canEditFiche,
} from "./permissions";

describe("canTransition", () => {
  it("autorise un référent à soumettre un brouillon", () => {
    expect(canTransition("PROSPECTEUR", "BROUILLON", "SOUMISE")).toBe(true);
  });

  it("seul l'admin peut valider une fiche soumise", () => {
    expect(canTransition("COMMERCIAL", "SOUMISE", "VALIDEE")).toBe(false);
    expect(canTransition("ADMIN", "SOUMISE", "VALIDEE")).toBe(true);
  });

  it("seul l'admin peut affecter une fiche validée", () => {
    expect(canTransition("ADMIN", "VALIDEE", "AFFECTEE")).toBe(true);
    expect(canTransition("COMMERCIAL", "VALIDEE", "AFFECTEE")).toBe(false);
  });

  it("autorise commercial et admin à accepter/refuser une fiche affectée", () => {
    expect(canTransition("COMMERCIAL", "AFFECTEE", "ACCEPTEE")).toBe(true);
    expect(canTransition("COMMERCIAL", "AFFECTEE", "REFUSEE")).toBe(true);
    expect(canTransition("ADMIN", "AFFECTEE", "ACCEPTEE")).toBe(true);
  });

  it("interdit un référent d'accepter une fiche affectée", () => {
    expect(canTransition("PROSPECTEUR", "AFFECTEE", "ACCEPTEE")).toBe(false);
  });

  it("interdit toute transition depuis ARCHIVEE (état terminal)", () => {
    expect(canTransition("ADMIN", "ARCHIVEE", "SOUMISE")).toBe(false);
    expect(getAvailableTransitions("ADMIN", "ARCHIVEE")).toEqual([]);
  });

  it("interdit une transition non déclarée", () => {
    expect(canTransition("ADMIN", "BROUILLON", "ARCHIVEE")).toBe(false);
  });
});

describe("getAvailableTransitions", () => {
  it("liste les cibles d'un admin sur une fiche refusée", () => {
    expect(getAvailableTransitions("ADMIN", "REFUSEE").sort()).toEqual(
      ["AFFECTEE", "ARCHIVEE"].sort()
    );
  });

  it("le référent peut retourner une fiche soumise en brouillon", () => {
    expect(getAvailableTransitions("PROSPECTEUR", "SOUMISE")).toEqual(["BROUILLON"]);
  });

  it("DIRECTION_GENERALE n'a aucune transition disponible", () => {
    expect(getAvailableTransitions("DIRECTION_GENERALE", "SOUMISE")).toEqual([]);
    expect(getAvailableTransitions("DIRECTION_GENERALE", "BROUILLON")).toEqual([]);
    expect(getAvailableTransitions("DIRECTION_GENERALE", "AFFECTEE")).toEqual([]);
  });
});

describe("helpers de rôle", () => {
  it("ADMIN et DIRECTION_GENERALE gèrent les utilisateurs, seul ADMIN affecte les fiches", () => {
    expect(canManageUsers("ADMIN")).toBe(true);
    expect(canManageUsers("DIRECTION_GENERALE")).toBe(true);
    expect(canManageUsers("COMMERCIAL")).toBe(false);
    expect(canManageUsers("PROSPECTEUR")).toBe(false);
    expect(canAssignFiche("ADMIN")).toBe(true);
    expect(canAssignFiche("DIRECTION_GENERALE")).toBe(false);
    expect(canAssignFiche("COMMERCIAL")).toBe(false);
  });
});

describe("canEditFiche", () => {
  const me = "user-1";
  const other = "user-2";

  it("l'admin peut toujours éditer", () => {
    expect(canEditFiche("ADMIN", me, other, null, "SOUMISE")).toBe(true);
  });

  it("le commercial édite ses fiches ou celles qui lui sont affectées", () => {
    expect(canEditFiche("COMMERCIAL", me, me, null, "AFFECTEE")).toBe(true);
    expect(canEditFiche("COMMERCIAL", me, other, me, "AFFECTEE")).toBe(true);
    expect(canEditFiche("COMMERCIAL", me, other, other, "AFFECTEE")).toBe(false);
  });

  it("le référent n'édite que ses propres fiches", () => {
    expect(canEditFiche("PROSPECTEUR", me, me, null, "BROUILLON")).toBe(true);
    expect(canEditFiche("PROSPECTEUR", me, other, me, "BROUILLON")).toBe(false);
  });

  it("DIRECTION_GENERALE ne peut jamais éditer une fiche", () => {
    expect(canEditFiche("DIRECTION_GENERALE", me, me, null, "BROUILLON")).toBe(false);
    expect(canEditFiche("DIRECTION_GENERALE", me, me, null, "SOUMISE")).toBe(false);
  });

  it("une fiche archivée n'est jamais éditable, même par l'admin", () => {
    expect(canEditFiche("ADMIN", me, me, null, "ARCHIVEE")).toBe(false);
    expect(canEditFiche("COMMERCIAL", me, me, me, "ARCHIVEE")).toBe(false);
    expect(canEditFiche("PROSPECTEUR", me, me, null, "ARCHIVEE")).toBe(false);
  });
});
