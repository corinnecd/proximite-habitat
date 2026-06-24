import { createClient } from '@supabase/supabase-js';

// Seed NON DESTRUCTIF d'une succursale de test.
//   node --env-file=.env.local scripts/seed-succursale.mjs [slug]
// slug par défaut : succursale-1
// Crée : 10 référents, 5 commerciaux, 1 directeur (ADMIN) + ~30 fiches réparties
// dans des statuts variés avec des données fictives cohérentes (CA, refus, historique).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SLUG = process.argv[2] || 'succursale-1';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Variables manquantes. Lance : node --env-file=.env.local scripts/seed-succursale.mjs [slug]');
  process.exit(1);
}

const s = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── Helpers aléatoires ─────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rint = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

const PRENOMS = ['Jean', 'Claire', 'Paul', 'Julie', 'Nicolas', 'Valérie', 'Isabelle', 'Marc', 'Lucie', 'Thierry', 'Sylvie', 'Antoine', 'Anne', 'Thomas', 'Céline', 'Frédéric', 'Luc', 'Émilie', 'Benoît', 'Hélène', 'Karim', 'Nadia', 'Hugo', 'Léa', 'Romain'];
const NOMS = ['Dupont', 'Martin', 'Bernard', 'Petit', 'Leroy', 'Chevalier', 'Simon', 'Fontaine', 'Girard', 'Renard', 'Bonnet', 'Blanc', 'Durand', 'Laurent', 'Aubert', 'Leclerc', 'Robert', 'Lefebvre', 'Moreau', 'Rousseau', 'Vincent', 'Muller', 'Faure', 'Garcia', 'Roux'];
const VILLES = [
  ['Lyon', '69001'], ['Marseille', '13001'], ['Paris', '75011'], ['Toulouse', '31000'],
  ['Nantes', '44000'], ['Bordeaux', '33000'], ['Lille', '59000'], ['Nice', '06000'],
  ['Strasbourg', '67000'], ['Rennes', '35000'], ['Grenoble', '38000'], ['Dijon', '21000'],
  ['Montpellier', '34000'], ['Reims', '51100'], ['Le Havre', '76600'],
];
const MOTIFS = ['RDC', 'ANNULATION', 'REFUS_CLASSIQUE'];

async function main() {
  // ── Cible : la succursale ──────────────────────────────────────────────────
  const { data: org, error: orgErr } = await s.from('organizations').select('id, name, company_id').eq('slug', SLUG).single();
  if (orgErr || !org) { console.error(`Succursale slug="${SLUG}" introuvable.`); process.exit(1); }
  console.log(`Cible : ${org.name} (id=${org.id})`);

  // Garde-fou : ne pas re-seeder si déjà peuplée
  const { count: existing } = await s.from('profiles').select('id', { count: 'exact', head: true }).eq('organization_id', org.id);
  if ((existing ?? 0) > 0) {
    console.error(`⚠️  Cette succursale a déjà ${existing} utilisateur(s). Abandon pour éviter les doublons.`);
    console.error('   (Supprime-les d\'abord si tu veux re-seeder.)');
    process.exit(1);
  }

  // ── 1. Utilisateurs ──────────────────────────────────────────────────────────
  const defs = [];
  defs.push({ role: 'ADMIN', first: 'Directeur', last: 'Succursale1', email: `directeur.s1@succ-test.fr` });
  for (let i = 1; i <= 5; i++) defs.push({ role: 'COMMERCIAL', first: pick(PRENOMS), last: pick(NOMS), email: `commercial${i}.s1@succ-test.fr` });
  for (let i = 1; i <= 10; i++) defs.push({ role: 'PROSPECTEUR', first: pick(PRENOMS), last: pick(NOMS), email: `referent${i}.s1@succ-test.fr` });

  console.log(`\n1. Création de ${defs.length} utilisateurs...`);
  const created = { ADMIN: [], COMMERCIAL: [], PROSPECTEUR: [] };
  for (const u of defs) {
    const { data: auth, error: aerr } = await s.auth.admin.createUser({ email: u.email, password: 'Test1234!', email_confirm: true });
    if (aerr || !auth.user) { console.error(`   ERREUR auth ${u.email}: ${aerr?.message}`); continue; }
    const { error: perr } = await s.from('profiles').insert({
      id: auth.user.id, organization_id: org.id, email: u.email,
      first_name: u.first, last_name: u.last, role: u.role,
    });
    if (perr) { console.error(`   ERREUR profil ${u.email}: ${perr.message}`); await s.auth.admin.deleteUser(auth.user.id); continue; }
    created[u.role].push(auth.user.id);
    console.log(`   OK — ${u.role.padEnd(11)} ${u.first} ${u.last} (${u.email})`);
  }

  const referents = created.PROSPECTEUR;
  const commerciaux = created.COMMERCIAL;
  if (referents.length === 0 || commerciaux.length === 0) { console.error('Pas assez d\'utilisateurs créés.'); process.exit(1); }

  // ── 2. Fiches (~30) réparties par statut ───────────────────────────────────
  // [status, quantité]
  const plan = [
    ['BROUILLON', 4], ['SOUMISE', 4], ['VALIDEE', 3], ['AFFECTEE', 5],
    ['ACCEPTEE', 7], ['RETRACTATION', 2], ['REFUSEE', 3], ['ARCHIVEE', 2],
  ];

  console.log('\n2. Création des fiches...');
  let total = 0;
  for (const [status, qty] of plan) {
    for (let i = 0; i < qty; i++) {
      const [ville, cp] = pick(VILLES);
      const createdBy = pick(referents);
      const assigned = ['AFFECTEE', 'ACCEPTEE', 'RETRACTATION', 'REFUSEE', 'ARCHIVEE'].includes(status) ? pick(commerciaux) : null;
      const ago = rint(1, 80);                       // date de création (jours)
      const decisionAgo = Math.max(0, ago - rint(2, 10)); // date dernière action

      const fiche = {
        organization_id: org.id,
        status,
        created_by: createdBy,
        assigned_to: assigned,
        prospect_nom: pick(NOMS),
        prospect_prenom: pick(PRENOMS),
        prospect_adresse: `${rint(1, 90)} rue ${pick(['de la Paix', 'des Lilas', 'Victor Hugo', 'du Général Leclerc', 'des Fleurs'])}`,
        prospect_cp: cp,
        prospect_ville: ville,
        prospect_telephone: `06 ${rint(10, 99)} ${rint(10, 99)} ${rint(10, 99)} ${rint(10, 99)}`,
        prospect_email: `prospect${total}@exemple.fr`,
        disponibilites: ['LU', 'ME', 'VE'],
        modes_chauffage: [pick(['Gaz', 'Électrique', 'Fioul', 'Bois'])],
        systemes_chauffage: ['Chaudière', 'Radiateur'],
        systemes_ventilation: [pick(['VMC Simple Flux', 'VMC Double Flux'])],
        nature_isolant: [pick(['Laine de verre', 'Laine de roche', 'Polystyrène'])],
        types_pose_toiture: ['Combles perdus'],
        materiaux_toiture: ['Terre cuite mécanique'],
        surface_chauffee: rint(70, 180),
        nb_habitants: rint(1, 6),
        annee_construction: rint(1960, 2015),
        temperature_confort: rint(19, 22),
        consentement_rgpd: status !== 'BROUILLON',
        montant_ht: status === 'ACCEPTEE' ? rint(4000, 16000) : null,
        motif_refus: status === 'REFUSEE' ? pick(MOTIFS) : null,
        created_at: daysAgo(ago),
        updated_at: daysAgo(decisionAgo),
      };

      const { data: row, error: ferr } = await s.from('fiches').insert(fiche).select('id, reference').single();
      if (ferr) { console.error(`   ERREUR fiche [${status}]: ${ferr.message}`); continue; }

      // ── Historique cohérent (pour les stats : dates de soumission, décisions) ──
      const hist = [];
      if (status !== 'BROUILLON') {
        hist.push({ new_status: 'SOUMISE', old_status: 'BROUILLON', at: daysAgo(ago), by: createdBy });
      }
      if (['ACCEPTEE', 'REFUSEE', 'RETRACTATION', 'ARCHIVEE'].includes(status)) {
        hist.push({ new_status: status, old_status: 'AFFECTEE', at: daysAgo(decisionAgo), by: assigned ?? createdBy });
      }
      for (const h of hist) {
        await s.from('fiche_history').insert({
          fiche_id: row.id, organization_id: org.id, user_id: h.by,
          action: `Statut : ${h.old_status} → ${h.new_status}`,
          old_status: h.old_status, new_status: h.new_status, created_at: h.at,
        });
      }
      total++;
    }
    console.log(`   OK — ${qty} fiches [${status}]`);
  }

  console.log(`\n✅ Seed terminé : ${defs.length} utilisateurs + ${total} fiches dans « ${org.name} ».`);
  console.log('\n📋 Connexion (mot de passe commun) :');
  console.log('   directeur.s1@succ-test.fr   / Test1234!   (ADMIN)');
  console.log('   commercial1..5.s1@succ-test.fr / Test1234! (COMMERCIAL)');
  console.log('   referent1..10.s1@succ-test.fr  / Test1234! (PROSPECTEUR)');
}

main().catch((e) => { console.error(e); process.exit(1); });
