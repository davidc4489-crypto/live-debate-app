/**
 * Applique la migration 00003 (profils + intérêts) sur PostgreSQL Supabase.
 *
 * Prérequis dans backend/.env :
 *   DATABASE_URL=postgresql://postgres.[ref]:[MOT_DE_PASSE]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
 * (Supabase → Project Settings → Database → Connection string → URI)
 *
 * Usage : npm run migrate:profiles
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

config({ path: resolve(process.cwd(), ".env") });

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "../../supabase/migrations/00003_user_profiles.sql");

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl || databaseUrl.includes("your-project")) {
  console.error(`
❌ DATABASE_URL manquant ou invalide dans backend/.env

Appliquez la migration manuellement :
  1. Ouvrez https://supabase.com/dashboard → votre projet → SQL Editor
  2. New query → collez le contenu de :
     supabase/migrations/00003_user_profiles.sql
  3. Cliquez Run

Puis rechargez la page profil.
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
  console.log("Connexion OK, application de 00003_user_profiles.sql…");
  await client.query(sql);
  console.log("✅ Migration appliquée (interests, user_interests, RPC profil).");
} catch (error) {
  console.error("❌ Erreur migration :", error.message);
  console.error("\nEssayez via le SQL Editor Supabase (voir instructions ci-dessus).");
  process.exit(1);
} finally {
  await client.end();
}
