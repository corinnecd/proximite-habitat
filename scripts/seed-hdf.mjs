import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Variables manquantes. Lance avec : node --env-file=.env.local scripts/seed-hdf.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  // ── 0. Trouver l'organisation PROXI-HABITAT HDF ──
  console.log('0. Recherche de la succursale PROXI-HABITAT HDF...');
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .ilike('name', '%proxi-habitat hdf%')
    .single();

  if (!org) {
    console.error('Succursale PROXI-HABITAT HDF introuvable !');
    process.exit(1);
  }
  console.log(`   OK — ${org.name} (${org.id})`);

  // ── 1. Création des utilisateurs ──
  const users = [
    // 2 Direction (ADMIN rattachés à HDF)
    { email: 'direction1@hdf.fr',    password: 'Direction123!',   first_name: 'François',  last_name: 'Delcourt',   role: 'ADMIN' },
    { email: 'direction2@hdf.fr',    password: 'Direction123!',   first_name: 'Nathalie',  last_name: 'Carpentier', role: 'ADMIN' },
    // 5 Référents
    { email: 'referent1@hdf.fr',     password: 'Referent123!',    first_name: 'Julien',    last_name: 'Lemaire',    role: 'PROSPECTEUR' },
    { email: 'referent2@hdf.fr',     password: 'Referent123!',    first_name: 'Audrey',    last_name: 'Vasseur',    role: 'PROSPECTEUR' },
    { email: 'referent3@hdf.fr',     password: 'Referent123!',    first_name: 'Romain',    last_name: 'Dufour',     role: 'PROSPECTEUR' },
    { email: 'referent4@hdf.fr',     password: 'Referent123!',    first_name: 'Céline',    last_name: 'Bracq',      role: 'PROSPECTEUR' },
    { email: 'referent5@hdf.fr',     password: 'Referent123!',    first_name: 'Maxime',    last_name: 'Poulain',    role: 'PROSPECTEUR' },
    // 4 Commerciaux
    { email: 'commercial1@hdf.fr',   password: 'Commercial123!',  first_name: 'Stéphane',  last_name: 'Lecomte',    role: 'COMMERCIAL' },
    { email: 'commercial2@hdf.fr',   password: 'Commercial123!',  first_name: 'Virginie',  last_name: 'Dubois',     role: 'COMMERCIAL' },
    { email: 'commercial3@hdf.fr',   password: 'Commercial123!',  first_name: 'Arnaud',    last_name: 'Hermant',    role: 'COMMERCIAL' },
    { email: 'commercial4@hdf.fr',   password: 'Commercial123!',  first_name: 'Sandrine',  last_name: 'Crépel',     role: 'COMMERCIAL' },
  ];

  console.log('\n1. Création des 11 utilisateurs HDF...');
  const created = [];

  for (const u of users) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (authError) { console.error(`   ERREUR ${u.email}:`, authError.message); continue; }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      organization_id: org.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role,
    });
    if (profileError) { console.error(`   ERREUR profil ${u.email}:`, profileError.message); continue; }

    console.log(`   OK — ${u.role.padEnd(12)} ${u.first_name} ${u.last_name} (${u.email})`);
    created.push({ ...u, id: authData.user.id });
  }

  // Index rapides
  const admins      = created.filter(u => u.role === 'ADMIN');
  const referents   = created.filter(u => u.role === 'PROSPECTEUR');
  const commerciaux = created.filter(u => u.role === 'COMMERCIAL');

  if (referents.length < 5 || commerciaux.length < 4) {
    console.error('Pas assez d\'utilisateurs créés, abandon.');
    process.exit(1);
  }

  // ── 2. Création des 14 fiches ──
  console.log('\n2. Création des 14 fiches clients HDF...');

  const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

  // Villes HDF réalistes
  const fiches = [
    // 6 ACCEPTEES
    { nom: 'Lefebvre',   prenom: 'Michel',    ville: 'Lille',          cp: '59000', status: 'ACCEPTEE',     ref: 0, comm: 0, ago: 35, montant: 8500  },
    { nom: 'Delattre',   prenom: 'Isabelle',  ville: 'Roubaix',       cp: '59100', status: 'ACCEPTEE',     ref: 1, comm: 1, ago: 28, montant: 12300 },
    { nom: 'Vandenberghe', prenom: 'Pierre',  ville: 'Tourcoing',     cp: '59200', status: 'ACCEPTEE',     ref: 2, comm: 2, ago: 22, montant: 9800  },
    { nom: 'Desmarest',  prenom: 'Caroline',  ville: 'Dunkerque',     cp: '59140', status: 'ACCEPTEE',     ref: 3, comm: 3, ago: 18, montant: 7200  },
    { nom: 'Caron',      prenom: 'Philippe',  ville: 'Valenciennes',  cp: '59300', status: 'ACCEPTEE',     ref: 4, comm: 0, ago: 14, montant: 15600 },
    { nom: 'Pruvost',    prenom: 'Martine',   ville: 'Lens',          cp: '62300', status: 'ACCEPTEE',     ref: 0, comm: 1, ago: 10, montant: 6900  },

    // 3 REFUSEES (motifs différents)
    { nom: 'Dhainaut',   prenom: 'Gérard',    ville: 'Arras',         cp: '62000', status: 'REFUSEE',      ref: 1, comm: 2, ago: 25, motif: 'RDC' },
    { nom: 'Watteau',    prenom: 'Nathalie',  ville: 'Calais',        cp: '62100', status: 'REFUSEE',      ref: 3, comm: 3, ago: 20, motif: 'ANNULATION' },
    { nom: 'Hennion',    prenom: 'Christophe', ville: 'Douai',        cp: '59500', status: 'REFUSEE',      ref: 4, comm: 0, ago: 15, motif: 'REFUS_CLASSIQUE' },

    // 2 SOUMISE (à valider)
    { nom: 'Desplanques', prenom: 'Sophie',   ville: 'Béthune',       cp: '62400', status: 'SOUMISE',      ref: 2, comm: null, ago: 3 },
    { nom: 'Carpentier', prenom: 'Laurent',   ville: 'Cambrai',       cp: '59400', status: 'SOUMISE',      ref: 0, comm: null, ago: 2 },

    // 1 ARCHIVEE
    { nom: 'Leclercq',   prenom: 'Françoise', ville: 'Maubeuge',     cp: '59600', status: 'ARCHIVEE',     ref: 3, comm: 2, ago: 60 },

    // 2 RETRACTATION (attente validation client)
    { nom: 'Delannoy',   prenom: 'Thierry',   ville: 'Boulogne-sur-Mer', cp: '62200', status: 'RETRACTATION', ref: 1, comm: 1, ago: 8 },
    { nom: 'Froidure',   prenom: 'Sylvie',    ville: 'Saint-Omer',    cp: '62500', status: 'RETRACTATION', ref: 4, comm: 3, ago: 5 },
  ];

  const addresses = [
    '14 rue Jean Jaurès', '8 avenue Foch', '23 rue Pasteur', '6 place de la République',
    '45 boulevard Carnot', '17 rue Victor Hugo', '3 impasse des Lilas', '29 rue Gambetta',
    '11 allée des Tilleuls', '56 rue du Maréchal Leclerc', '7 rue de la Gare', '19 rue Nationale',
    '32 avenue de la Liberté', '2 rue des Écoles',
  ];

  for (let i = 0; i < fiches.length; i++) {
    const f = fiches[i];
    const refUser = referents[f.ref];
    const commUser = f.comm !== null ? commerciaux[f.comm] : null;
    const adminUser = admins[0];

    const ficheData = {
      organization_id: org.id,
      status: f.status,
      created_by: refUser.id,
      assigned_to: commUser?.id ?? null,
      prospect_nom: f.nom,
      prospect_prenom: f.prenom,
      prospect_adresse: addresses[i],
      prospect_cp: f.cp,
      prospect_ville: f.ville,
      prospect_telephone: `06 ${String(Math.floor(Math.random() * 100)).padStart(2, '0')} ${String(Math.floor(Math.random() * 100)).padStart(2, '0')} ${String(Math.floor(Math.random() * 100)).padStart(2, '0')} ${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`,
      disponibilites: ['LU', 'ME', 'VE'],
      modes_chauffage: ['Gaz'],
      systemes_chauffage: ['Chaudière', 'Radiateur'],
      systemes_ventilation: ['VMC Simple Flux'],
      nature_isolant: ['Laine de verre'],
      types_pose_toiture: ['Combles perdus'],
      materiaux_toiture: ['Terre cuite mécanique'],
      surface_chauffee: 80 + Math.floor(Math.random() * 80),
      nb_habitants: 2 + Math.floor(Math.random() * 4),
      annee_construction: 1960 + Math.floor(Math.random() * 50),
      temperature_confort: 20,
      consentement_rgpd: f.status !== 'BROUILLON',
      montant_ht: f.montant ?? null,
      motif_refus: f.motif ?? null,
      created_at: daysAgo(f.ago),
      updated_at: daysAgo(Math.max(0, f.ago - 2)),
    };

    const { data: fiche, error: ficheError } = await supabase
      .from('fiches')
      .insert(ficheData)
      .select('id, reference')
      .single();

    if (ficheError) {
      console.error(`   ERREUR fiche ${f.prenom} ${f.nom}:`, ficheError.message);
      continue;
    }

    // ── Historique réaliste ──
    const history = [];
    const hBase = { fiche_id: fiche.id, organization_id: org.id };

    // Toujours : création
    history.push({ ...hBase, user_id: refUser.id, action: 'Statut: BROUILLON → BROUILLON', old_status: null, new_status: 'BROUILLON', comment: 'Création de la fiche', created_at: daysAgo(f.ago) });

    if (f.status !== 'BROUILLON') {
      // Soumission
      history.push({ ...hBase, user_id: refUser.id, action: 'Statut: BROUILLON → SOUMISE', old_status: 'BROUILLON', new_status: 'SOUMISE', comment: 'Fiche complétée et soumise pour validation', created_at: daysAgo(f.ago - 1) });
    }

    if (['AFFECTEE', 'ACCEPTEE', 'REFUSEE', 'ARCHIVEE', 'RETRACTATION'].includes(f.status)) {
      // Validation
      history.push({ ...hBase, user_id: adminUser.id, action: 'Statut: SOUMISE → VALIDEE', old_status: 'SOUMISE', new_status: 'VALIDEE', comment: 'Fiche validée par la direction', created_at: daysAgo(f.ago - 2) });
      // Affectation
      history.push({ ...hBase, user_id: adminUser.id, action: 'Statut: VALIDEE → AFFECTEE', old_status: 'VALIDEE', new_status: 'AFFECTEE', comment: `Affectée à ${commUser?.first_name} ${commUser?.last_name}`, created_at: daysAgo(f.ago - 2) });
    }

    if (f.status === 'ACCEPTEE') {
      history.push({ ...hBase, user_id: commUser?.id, action: 'Statut: AFFECTEE → ACCEPTEE', old_status: 'AFFECTEE', new_status: 'ACCEPTEE', comment: 'Client accepte le devis — signature du contrat', created_at: daysAgo(f.ago - 4) });
    }

    if (f.status === 'REFUSEE') {
      const motifLabels = { RDC: 'Rétractation dans le délai légal', ANNULATION: 'Client annule le RDV', REFUS_CLASSIQUE: 'Client refuse le devis après présentation' };
      history.push({ ...hBase, user_id: commUser?.id, action: 'Statut: AFFECTEE → REFUSEE', old_status: 'AFFECTEE', new_status: 'REFUSEE', comment: motifLabels[f.motif], created_at: daysAgo(f.ago - 3) });
    }

    if (f.status === 'RETRACTATION') {
      history.push({ ...hBase, user_id: commUser?.id, action: 'Statut: AFFECTEE → RETRACTATION', old_status: 'AFFECTEE', new_status: 'RETRACTATION', comment: 'En attente de la confirmation du client', created_at: daysAgo(f.ago - 3) });
    }

    if (f.status === 'ARCHIVEE') {
      history.push({ ...hBase, user_id: commUser?.id, action: 'Statut: AFFECTEE → ACCEPTEE', old_status: 'AFFECTEE', new_status: 'ACCEPTEE', comment: 'Client accepte — contrat signé', created_at: daysAgo(f.ago - 5) });
      history.push({ ...hBase, user_id: adminUser.id, action: 'Statut: ACCEPTEE → ARCHIVEE', old_status: 'ACCEPTEE', new_status: 'ARCHIVEE', comment: 'Dossier clôturé et archivé', created_at: daysAgo(f.ago - 10) });
    }

    const { error: histError } = await supabase.from('fiche_history').insert(history);
    if (histError) console.error(`   WARN historique ${f.nom}:`, histError.message);

    console.log(`   OK — ${fiche.reference} ${f.prenom} ${f.nom} (${f.ville}) [${f.status}]${f.motif ? ` motif:${f.motif}` : ''}${f.montant ? ` ${f.montant}€` : ''}`);
  }

  // ── 3. Résumé ──
  console.log('\n✅ Seed HDF terminé !');
  console.log('\n┌─────────────────────────┬───────────────────┬──────────────────┐');
  console.log('│ Email                   │ Mot de passe      │ Rôle             │');
  console.log('├─────────────────────────┼───────────────────┼──────────────────┤');
  for (const u of created) {
    console.log(`│ ${u.email.padEnd(23)} │ ${u.password.padEnd(17)} │ ${u.role.padEnd(16)} │`);
  }
  console.log('└─────────────────────────┴───────────────────┴──────────────────┘');
}

seed().catch(console.error);
