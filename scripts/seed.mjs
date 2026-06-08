import { createClient } from '@supabase/supabase-js';

// Les secrets ne doivent JAMAIS être codés en dur ici.
// Lance le script avec : node --env-file=.env.local scripts/seed.mjs
// (ou via `npm run seed`), de façon à charger les variables depuis .env.local.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Lance le seed avec : node --env-file=.env.local scripts/seed.mjs (ou `npm run seed`).'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  // ── 0. Nettoyage des données existantes ──────────────────────────────────────
  console.log('0. Nettoyage des données existantes...');
  const { data: orgs } = await supabase.from('organizations').select('id');
  if (orgs && orgs.length > 0) {
    const orgIds = orgs.map(o => o.id);
    // Supprimer dans l'ordre (contraintes FK)
    await supabase.from('notifications').delete().in('user_id',
      (await supabase.from('profiles').select('id').in('organization_id', orgIds)).data?.map(p => p.id) ?? []
    );
    await supabase.from('fiche_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('fiche_photos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('fiches').delete().in('organization_id', orgIds);
    await supabase.from('profiles').delete().in('organization_id', orgIds);
    await supabase.from('organizations').delete().in('id', orgIds);
    // Supprimer les utilisateurs auth
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    for (const u of authUsers?.users ?? []) {
      await supabase.auth.admin.deleteUser(u.id);
    }
    console.log('   OK — données nettoyées');
  } else {
    console.log('   OK — aucune donnée existante');
  }

  // ── 1. Organisation ──────────────────────────────────────────────────────────
  console.log('\n1. Création de l\'organisation PHC...');
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: 'Proximité Habitat Conseil', slug: 'phc' })
    .select()
    .single();

  if (orgError) {
    console.error('Erreur org:', orgError.message);
    process.exit(1);
  }
  console.log('   OK — org id:', org.id);

  const users = [
    { email: 'admin@phc.fr', password: 'Admin123!', first_name: 'Marie', last_name: 'Direction', role: 'ADMIN' },
    { email: 'direction@phc.fr', password: 'Admin123!', first_name: 'Pierre', last_name: 'Dupont', role: 'ADMIN' },
    { email: 'commercial1@phc.fr', password: 'Commercial123!', first_name: 'Sophie', last_name: 'Martin', role: 'COMMERCIAL' },
    { email: 'commercial2@phc.fr', password: 'Commercial123!', first_name: 'Lucas', last_name: 'Bernard', role: 'COMMERCIAL' },
    { email: 'commercial3@phc.fr', password: 'Commercial123!', first_name: 'Emma', last_name: 'Petit', role: 'COMMERCIAL' },
    { email: 'prospecteur1@phc.fr', password: 'Prospecteur123!', first_name: 'Alexandre', last_name: 'Moreau', role: 'PROSPECTEUR' },
    { email: 'prospecteur2@phc.fr', password: 'Prospecteur123!', first_name: 'Camille', last_name: 'Leroy', role: 'PROSPECTEUR' },
  ];

  console.log('\n2. Création des utilisateurs...');
  const createdUsers = [];

  for (const u of users) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });

    if (authError) {
      console.error(`   ERREUR ${u.email}:`, authError.message);
      continue;
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      organization_id: org.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role,
    });

    if (profileError) {
      console.error(`   ERREUR profil ${u.email}:`, profileError.message);
      continue;
    }

    console.log(`   OK — ${u.role.padEnd(12)} ${u.first_name} ${u.last_name} (${u.email})`);
    createdUsers.push({ ...u, id: authData.user.id });
  }

  // 20 fiches réparties inégalement sur 3 commerciaux
  // Index : 0=admin1 1=admin2 2=commercial1(Sophie) 3=commercial2(Lucas) 4=commercial3(Emma) 5=prosp1(Alexandre) 6=prosp2(Camille)
  console.log('\n3. Création des fiches de test...');
  const fiches = [
    // ── Brouillons (prospecteurs, non affectés) ──
    { nom: 'Dupont',     prenom: 'Jean',      ville: 'Lyon',          cp: '69001', status: 'BROUILLON', created_by: 5 },
    { nom: 'Martin',     prenom: 'Claire',    ville: 'Marseille',     cp: '13001', status: 'BROUILLON', created_by: 6 },
    { nom: 'Garnier',    prenom: 'Éric',      ville: 'Grenoble',      cp: '38000', status: 'BROUILLON', created_by: 5 },

    // ── Soumises (en attente d'affectation) ──
    { nom: 'Bernard',    prenom: 'Paul',      ville: 'Paris',         cp: '75011', status: 'SOUMISE', created_by: 5 },
    { nom: 'Petit',      prenom: 'Julie',     ville: 'Toulouse',      cp: '31000', status: 'SOUMISE', created_by: 6 },

    // ── Sophie Martin (commercial1) — 8 fiches ──
    { nom: 'Leroy',      prenom: 'Nicolas',   ville: 'Nantes',        cp: '44000', status: 'AFFECTEE',  created_by: 5, assigned_to: 2 },
    { nom: 'Chevalier',  prenom: 'Valérie',   ville: 'Montpellier',   cp: '34000', status: 'AFFECTEE',  created_by: 6, assigned_to: 2 },
    { nom: 'Simon',      prenom: 'Isabelle',  ville: 'Strasbourg',    cp: '67000', status: 'ACCEPTEE',  created_by: 6, assigned_to: 2 },
    { nom: 'Fontaine',   prenom: 'Marc',      ville: 'Rennes',        cp: '35000', status: 'ACCEPTEE',  created_by: 5, assigned_to: 2 },
    { nom: 'Girard',     prenom: 'Lucie',     ville: 'Bordeaux',      cp: '33000', status: 'ACCEPTEE',  created_by: 6, assigned_to: 2 },
    { nom: 'Renard',     prenom: 'Thierry',   ville: 'Dijon',         cp: '21000', status: 'REFUSEE',   created_by: 5, assigned_to: 2 },
    { nom: 'Bonnet',     prenom: 'Sylvie',    ville: 'Metz',          cp: '57000', status: 'ARCHIVEE',  created_by: 6, assigned_to: 2 },
    { nom: 'Blanc',      prenom: 'Antoine',   ville: 'Reims',         cp: '51100', status: 'ARCHIVEE',  created_by: 5, assigned_to: 2 },

    // ── Lucas Bernard (commercial2) — 4 fiches ──
    { nom: 'Durand',     prenom: 'Anne',      ville: 'Bordeaux',      cp: '33000', status: 'AFFECTEE',  created_by: 6, assigned_to: 3 },
    { nom: 'Laurent',    prenom: 'Thomas',    ville: 'Rennes',        cp: '35000', status: 'REFUSEE',   created_by: 5, assigned_to: 3 },
    { nom: 'Aubert',     prenom: 'Céline',    ville: 'Caen',          cp: '14000', status: 'ACCEPTEE',  created_by: 6, assigned_to: 3 },
    { nom: 'Leclerc',    prenom: 'Frédéric',  ville: 'Rouen',         cp: '76000', status: 'ARCHIVEE',  created_by: 5, assigned_to: 3 },

    // ── Emma Petit (commercial3) — 6 fiches ──
    { nom: 'Robert',     prenom: 'Marc',      ville: 'Nice',          cp: '06000', status: 'AFFECTEE',  created_by: 5, assigned_to: 4 },
    { nom: 'Lefebvre',   prenom: 'Sophie',    ville: 'Lille',         cp: '59000', status: 'ACCEPTEE',  created_by: 6, assigned_to: 4 },
    { nom: 'Moreau',     prenom: 'Luc',       ville: 'Nantes',        cp: '44000', status: 'ACCEPTEE',  created_by: 5, assigned_to: 4 },
    { nom: 'Rousseau',   prenom: 'Émilie',    ville: 'Toulon',        cp: '83000', status: 'REFUSEE',   created_by: 6, assigned_to: 4 },
    { nom: 'Vincent',    prenom: 'Benoît',    ville: 'Angers',        cp: '49000', status: 'ARCHIVEE',  created_by: 5, assigned_to: 4 },
    { nom: 'Muller',     prenom: 'Hélène',    ville: 'Strasbourg',    cp: '67000', status: 'ARCHIVEE',  created_by: 6, assigned_to: 4 },
  ];

  for (const f of fiches) {
    const ficheData = {
      organization_id: org.id,
      status: f.status,
      created_by: createdUsers[f.created_by]?.id,
      assigned_to: f.assigned_to != null ? createdUsers[f.assigned_to]?.id : null,
      prospect_nom: f.nom,
      prospect_prenom: f.prenom,
      prospect_adresse: '12 rue de la Paix',
      prospect_cp: f.cp,
      prospect_ville: f.ville,
      prospect_telephone: '06 12 34 56 78',
      disponibilites: ['LU', 'ME', 'VE'],
      modes_chauffage: ['Gaz'],
      systemes_chauffage: ['Chaudière', 'Radiateur'],
      systemes_ventilation: ['VMC Simple Flux'],
      nature_isolant: ['Laine de verre'],
      types_pose_toiture: ['Combles perdus'],
      materiaux_toiture: ['Terre cuite mécanique'],
      surface_chauffee: 95 + Math.floor(Math.random() * 60),
      nb_habitants: 2 + Math.floor(Math.random() * 4),
      annee_construction: 1970 + Math.floor(Math.random() * 40),
      temperature_confort: 20,
      consentement_rgpd: f.status !== 'BROUILLON',
    };

    if (!ficheData.created_by) {
      console.error(`   SKIP fiche ${f.prenom} ${f.nom} — créateur introuvable`);
      continue;
    }

    const { data: fiche, error: ficheError } = await supabase
      .from('fiches')
      .insert(ficheData)
      .select('reference')
      .single();

    if (ficheError) {
      console.error(`   ERREUR fiche ${f.prenom} ${f.nom}:`, ficheError.message);
    } else {
      console.log(`   OK — ${fiche.reference} ${f.prenom} ${f.nom} (${f.ville}) [${f.status}]`);
    }
  }

  console.log('\n✅ Seed terminé !');
  console.log('\n📋 Comptes de test :');
  console.log('   admin@phc.fr        / Admin123!');
  console.log('   commercial1@phc.fr  / Commercial123!');
  console.log('   prospecteur1@phc.fr / Prospecteur123!');
}

seed().catch(console.error);
