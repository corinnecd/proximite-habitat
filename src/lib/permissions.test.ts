import { describe, it, expect } from "vitest";
import {
  canTransition,
  getAvailableTransitions,
  canAccessUsersPage,
  canMutateUsers,
  canAssignFiche,
  canEditFiche,
  canEditParcours,
} from "./permissions";

describe("canTransition", () => {
  it("autorise un référent à soumettre un brouillon", () => {
    expect(canTransition("PROSPECTEUR", "BROUILLON", "SOUMISE")).toBe(true);
  });

  it("seul l'admin peut valider une fiche soumise", () => {
    expect(canTransition("COMMERCIAL", "SOUMISE", "VALIDEE")).toBe(false);
    expect(canTransition("DIRECTION", "SOUMISE", "VALIDEE")).toBe(true);
  });

  it("seul l'admin peut affecter une fiche validée", () => {
    expect(canTransition("DIRECTION", "VALIDEE", "AFFECTEE")).toBe(true);
    expect(canTransition("COMMERCIAL", "VALIDEE", "AFFECTEE")).toBe(false);
  });

  it("autorise commercial et admin à accepter/refuser une fiche affectée", () => {
    expect(canTransition("COMMERCIAL", "AFFECTEE", "ACCEPTEE")).toBe(true);
    expect(canTransition("COMMERCIAL", "AFFECTEE", "REFUSEE")).toBe(true);
    expect(canTransition("DIRECTION", "AFFECTEE", "ACCEPTEE")).toBe(true);
  });

  it("interdit un référent d'accepter une fiche affectée", () => {
    expect(canTransition("PROSPECTEUR", "AFFECTEE", "ACCEPTEE")).toBe(false);
  });

  it("interdit toute transition depuis ARCHIVEE (état terminal)", () => {
    expect(canTransition("DIRECTION", "ARCHIVEE", "SOUMISE")).toBe(false);
    expect(getAvailableTransitions("DIRECTION", "ARCHIVEE")).toEqual([]);
  });

  it("interdit une transition non déclarée", () => {
    expect(canTransition("DIRECTION", "BROUILLON", "ARCHIVEE")).toBe(false);
  });
});

describe("getAvailableTransitions", () => {
  it("liste les cibles d'un admin sur une fiche refusée", () => {
    expect(getAvailableTransitions("DIRECTION", "REFUSEE").sort()).toEqual(
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
  it("la direction et la direction générale accèdent à la page Utilisateurs", () => {
    expect(canAccessUsersPage("DIRECTION")).toBe(true);
    expect(canAccessUsersPage("DIRECTION_GENERALE")).toBe(true);
    expect(canAccessUsersPage("SUPER_ADMIN")).toBe(true);
    expect(canAccessUsersPage("COMMERCIAL")).toBe(false);
    expect(canAccessUsersPage("PROSPECTEUR")).toBe(false);
  });

  it("la direction générale y est en lecture seule", () => {
    expect(canMutateUsers("DIRECTION")).toBe(true);
    expect(canMutateUsers("SUPER_ADMIN")).toBe(true);
    expect(canMutateUsers("DIRECTION_GENERALE")).toBe(false);
    expect(canMutateUsers("COMMERCIAL")).toBe(false);
  });

  it("seules la direction et le super admin affectent les fiches", () => {
    expect(canAssignFiche("DIRECTION")).toBe(true);
    expect(canAssignFiche("SUPER_ADMIN")).toBe(true);
    expect(canAssignFiche("DIRECTION_GENERALE")).toBe(false);
    expect(canAssignFiche("COMMERCIAL")).toBe(false);
  });
});

describe("SUPER_ADMIN dans la matrice de transitions", () => {
  it("dispose des mêmes transitions que la direction", () => {
    expect(canTransition("SUPER_ADMIN", "SOUMISE", "VALIDEE")).toBe(true);
    expect(canTransition("SUPER_ADMIN", "VALIDEE", "AFFECTEE")).toBe(true);
    expect(canTransition("SUPER_ADMIN", "AFFECTEE", "ACCEPTEE")).toBe(true);
    expect(canTransition("SUPER_ADMIN", "REFUSEE", "AFFECTEE")).toBe(true);
  });

  it("a bien des transitions disponibles, contrairement à la direction générale", () => {
    expect(getAvailableTransitions("SUPER_ADMIN", "AFFECTEE").length).toBeGreaterThan(0);
    expect(getAvailableTransitions("DIRECTION_GENERALE", "AFFECTEE")).toEqual([]);
  });
});

describe("canEditFiche", () => {
  const me = "user-1";
  const other = "user-2";

  it("l'admin peut toujours éditer", () => {
    expect(canEditFiche("DIRECTION", me, other, null, "SOUMISE")).toBe(true);
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
    expect(canEditFiche("DIRECTION", me, me, null, "ARCHIVEE")).toBe(false);
    expect(canEditFiche("COMMERCIAL", me, me, me, "ARCHIVEE")).toBe(false);
    expect(canEditFiche("PROSPECTEUR", me, me, null, "ARCHIVEE")).toBe(false);
  });
});

describe("canEditParcours", () => {
  it("autorise les trois profils parmi lesquels un chef d'équipe est nommé", () => {
    expect(canEditParcours("PROSPECTEUR")).toBe(true);
    expect(canEditParcours("COMMERCIAL")).toBe(true);
    expect(canEditParcours("DIRECTION")).toBe(true);
  });

  it("autorise le rôle CHEF_EQUIPE historique et le super admin", () => {
    expect(canEditParcours("CHEF_EQUIPE")).toBe(true);
    expect(canEditParcours("SUPER_ADMIN")).toBe(true);
  });

  it("refuse la direction générale, qui est en lecture seule", () => {
    expect(canEditParcours("DIRECTION_GENERALE")).toBe(false);
  });

  it("refuse un rôle absent", () => {
    expect(canEditParcours(undefined)).toBe(false);
    expect(canEditParcours(null)).toBe(false);
  });
});
