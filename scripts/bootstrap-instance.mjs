import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP D'UNE INSTANCE VIERGE (Modèle B — instance indépendante)
// ─────────────────────────────────────────────────────────────────────────────
// Crée, sur une base NEUVE : la société (companies) + son siège (organizations,
// is_hq=true) + le compte Direction Générale (auth + profile), et s'assure que les
// buckets Storage `photos` et `signatures` existent.
//
// NON DESTRUCTIF : refuse de s'exécuter si une société existe déjà (sauf --force).
//
// Pré-requis : le schéma doit déjà être appliqué (voir INSTALLATION.md).
//
// Usage :
//   node --env-file=.env.local scripts/bootstrap-instance.mjs \
//     --company "Nom Société" --hq "Siège" \
//     --email dg@societe.fr --password "MotDePasseFort" \
//     --first "Prénom" --last "Nom"
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (charge .env.local).');
  process.exit(1);
}

// ── Parsing minimal des arguments --clé valeur ──────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const company_name = args.company;
const hq_name = args.hq || 'Siège';
const dg_email = args.email;
const dg_password = args.password;
const dg_first = args.first;
const dg_last = args.last;
const force = args.force === 'true';

const missing = [];
if (!company_name) missing.push('--company');
if (!dg_email) missing.push('--email');
if (!dg_password) missing.push('--password');
if (!dg_first) missing.push('--first');
if (!dg_last) missing.push('--last');
if (missing.length) {
  console.error('Arguments manquants : ' + missing.join(', '));
  console.error('Exemple : node --env-file=.env.local scripts/bootstrap-instance.mjs --company "ACME" --hq "Siège" --email dg@acme.fr --password "Strong!123" --first Jean --last Martin');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dg_email)) { console.error('Email DG invalide.'); process.exit(1); }
if (dg_password.length < 8) { console.error('Mot de passe DG : 8 caractères minimum.'); process.exit(1); }

const s = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const slugify = (input) => input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);

async function uniqueSlug(table, name, fallback) {
  const base = slugify(name) || fallback;
  let slug = base;
  for (let i = 1; ; i++) {
    const { data } = await s.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${i}`;
  }
}

async function ensureBucket(name) {
  const { data: buckets } = await s.storage.listBuckets();
  if ((buckets ?? []).some((b) => b.name === name)) { console.log(`   bucket "${name}" déjà présent`); return; }
  const { error } = await s.storage.createBucket(name, { public: false });
  if (error) console.error(`   ⚠️ bucket "${name}": ${error.message}`);
  else console.log(`   bucket "${name}" créé (privé)`);
}

async function main() {
  // Garde-fou : instance déjà initialisée ?
  const { data: existing } = await s.from('companies').select('id, name').limit(1);
  if (existing && existing.length > 0 && !force) {
    console.error(`⚠️  Une société existe déjà ("${existing[0].name}"). Cette commande est réservée à une base VIERGE.`);
    console.error('   Ajoute --force seulement si tu sais ce que tu fais.');
    process.exit(1);
  }

  console.log('1. Buckets Storage…');
  await ensureBucket('photos');
  await ensureBucket('signatures');

  console.log('\n2. Société…');
  const companySlug = await uniqueSlug('companies', company_name, 'societe');
  const { data: company, error: cErr } = await s.from('companies')
    .insert({ name: company_name.trim(), slug: companySlug }).select().single();
  if (cErr || !company) { console.error('   Erreur société : ' + (cErr?.message)); process.exit(1); }
  console.log(`   OK — ${company.name} (${company.slug})`);

  console.log('\n3. Siège…');
  const hqSlug = await uniqueSlug('organizations', `${company_name}-${hq_name}`, 'siege');
  const { data: hq, error: hErr } = await s.from('organizations')
    .insert({ name: hq_name.trim(), slug: hqSlug, company_id: company.id, is_hq: true }).select().single();
  if (hErr || !hq) {
    console.error('   Erreur siège : ' + (hErr?.message));
    await s.from('companies').delete().eq('id', company.id);
    process.exit(1);
  }
  console.log(`   OK — ${hq.name} (${hq.slug})`);

  console.log('\n4. Compte Direction Générale…');
  const { data: auth, error: aErr } = await s.auth.admin.createUser({
    email: dg_email.trim().toLowerCase(), password: dg_password, email_confirm: true,
  });
  if (aErr || !auth.user) {
    console.error('   Erreur auth : ' + (aErr?.message));
    await s.from('organizations').delete().eq('id', hq.id);
    await s.from('companies').delete().eq('id', company.id);
    process.exit(1);
  }
  const { error: pErr } = await s.from('profiles').insert({
    id: auth.user.id, organization_id: hq.id, email: dg_email.trim().toLowerCase(),
    first_name: dg_first.trim(), last_name: dg_last.trim(), role: 'DIRECTION_GENERALE',
  });
  if (pErr) {
    console.error('   Erreur profil : ' + pErr.message);
    await s.auth.admin.deleteUser(auth.user.id);
    await s.from('organizations').delete().eq('id', hq.id);
    await s.from('companies').delete().eq('id', company.id);
    process.exit(1);
  }
  console.log(`   OK — DG ${dg_first} ${dg_last} (${dg_email})`);

  console.log('\n✅ Instance initialisée.');
  console.log('   Connexion DG :', dg_email, '/ (mot de passe fourni)');
  console.log('   Le DG peut maintenant créer ses succursales et ses utilisateurs depuis l\'application.');
}

main().catch((e) => { console.error(e); process.exit(1); });
