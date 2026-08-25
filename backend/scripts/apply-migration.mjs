/**
 * Applique une migration SQL sur la base PostgreSQL Supabase.
 *
 * Prérequis dans backend/.env :
 *   DATABASE_URL=postgresql://postgres.[ref]:[MOT_DE_PASSE]@aws-0-[région].pooler.supabase.com:5432/postgres
 * (Supabase → Project Settings → Database → Connection string → Session pooler)
 *
 * Utiliser le pooler, pas le host direct `db.[ref].supabase.co` : ce dernier
 * n'a plus d'enregistrement IPv4 et échoue en `ENETUNREACH` depuis un réseau
 * sans IPv6.
 *
 * Usage :
 *   npm run migrate 00015_resume_requester_and_title_guard
 *   npm run migrate -- --list
 *
 * Le fichier est joué dans une transaction : en cas d'erreur, rien n'est
 * appliqué. Les migrations du projet sont écrites pour être rejouables
 * (IF NOT EXISTS / DROP ... IF EXISTS), un second passage est donc sans effet.
 */
import { config } from "dotenv";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

config({ path: resolve(process.cwd(), ".env") });

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../../supabase/migrations");

function listMigrations() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

const arg = process.argv[2];

if (!arg || arg === "--list") {
  console.log("Migrations disponibles :\n");
  for (const file of listMigrations()) console.log(`  ${file.replace(/\.sql$/, "")}`);
  console.log("\nUsage : npm run migrate <nom-de-la-migration>");
  process.exit(arg === "--list" ? 0 : 1);
}

const name = arg.replace(/\.sql$/, "");
const migrationPath = join(migrationsDir, `${name}.sql`);

if (!existsSync(migrationPath)) {
  console.error(`❌ Migration introuvable : ${name}.sql`);
  console.error("   Liste : npm run migrate -- --list");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl || databaseUrl.includes("your-project") || databaseUrl.includes("<")) {
  console.error(`
❌ DATABASE_URL manquant ou encore sur la valeur d'exemple dans backend/.env

Récupérez-la dans Supabase → Project Settings → Database → Connection string
→ URI (elle contient le mot de passe de la base, pas la clé service role).

Sinon, appliquez la migration à la main :
  1. https://supabase.com/dashboard → votre projet → SQL Editor → New query
  2. Collez le contenu de :
     supabase/migrations/${name}.sql
  3. Run
`);
  process.exit(1);
}

let pg;
try {
  pg = await import("pg");
} catch {
  console.error("Installez pg : npm install pg --save-dev");
  process.exit(1);
}

const sql = readFileSync(migrationPath, "utf8");
const client = new pg.default.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  console.log(`Connexion OK — application de ${name}.sql…`);
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log(`✅ Migration ${name} appliquée.`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(`❌ Erreur migration (rien n'a été appliqué) : ${error.message}`);
  console.error("\nEssayez via le SQL Editor Supabase (voir instructions ci-dessus).");
  process.exit(1);
} finally {
  await client.end();
}
