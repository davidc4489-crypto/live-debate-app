import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env") });

const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans backend/.env");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_PASSWORD = "SeedDebates2026!";

const SEED_DEBATES = [
  {
    title: "IA generative: opportunite massive ou menace pour les emplois?",
    category: { name: "Technologie", slug: "technologie" },
    participants: [
      { email: "camille.seed@debately.local", firstName: "Camille", lastName: "Martin" },
      { email: "nassim.seed@debately.local", firstName: "Nassim", lastName: "Benali" },
    ],
    messages: [
      "L'IA generative accelere l'innovation dans la sante, l'education et la recherche.",
      "Elle automatise aussi des taches entieres, ce qui menace des millions d'emplois.",
      "Chaque revolution technologique a fini par creer plus d'emplois qu'elle n'en detruit.",
      "Cette fois, la vitesse d'adoption est sans precedent, les reconversions n'suivront pas.",
      "Il faut former massivement aux metiers augmentes par l'IA, pas seulement les bloquer.",
      "Sans cadre legal, les entreprises remplaceront d'abord les postes les moins qualifies.",
      "Un dividende technologique pourrait financer la transition des travailleurs touches.",
      "Le risque principal est la concentration des gains entre quelques acteurs tech.",
      "L'IA doit rester un outil au service de l'humain, avec transparence sur ses limites.",
      "Le debat n'est pas IA ou emplois, mais IA avec quelles regles et quelle solidarite.",
    ],
    views: 48,
    spectators: 6,
  },
  {
    title: "Faut-il limiter les reseaux sociaux pour les mineurs?",
    category: { name: "Société", slug: "societe" },
    participants: [
      { email: "sara.seed@debately.local", firstName: "Sara", lastName: "Dupont" },
      { email: "leo.seed@debately.local", firstName: "Leo", lastName: "Moreau" },
    ],
    messages: [
      "Les reseaux exposent les mineurs a une surexposition sociale et a la comparaison permanente.",
      "Une interdiction totale les exclut du monde numerique ou se joue aussi leur socialisation.",
      "Les algorithmes sont concus pour capter l'attention, pas pour proteger les adolescents.",
      "Mieux vaut eduquer au media literacy qu'interdire sans accompagner les familles.",
      "L'age minimum doit etre releve, avec verification et limites de temps imposes.",
      "Les plateformes doivent etre tenues responsables du contenu recommande aux jeunes.",
      "Un compte parental supervise permet de garder le lien tout en encadrant l'usage.",
      "Tant que le modele economique repose sur le temps d'ecran, la moderation restera insuffisante.",
      "Les etudes montrent un lien entre usage intensif et anxiete chez les ados.",
      "La solution est hybride: regles claires, outils de controle et sanctions aux plateformes.",
    ],
    views: 36,
    spectators: 4,
  },
];

async function getOrCreateCategory({ name, slug }) {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("categories")
    .insert({ name, slug })
    .select("id")
    .single();

  if (error) throw new Error(`Categorie ${name}: ${error.message}`);
  return data.id;
}

async function getOrCreateUser({ email, firstName, lastName }) {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw new Error(`Auth listUsers: ${listError.message}`);

  const existing = list.users.find((user) => user.email === email);
  if (existing) return existing.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (error) throw new Error(`Utilisateur ${email}: ${error.message}`);
  return data.user.id;
}

async function deleteDebateByTitle(title) {
  const { data: debate } = await supabase
    .from("debates")
    .select("id")
    .eq("title", title)
    .maybeSingle();

  if (!debate) return;

  await supabase.from("messages").delete().eq("debate_id", debate.id);
  await supabase.from("debate_views").delete().eq("debate_id", debate.id);
  await supabase.from("debate_participants").delete().eq("debate_id", debate.id);
  await supabase.from("debates").delete().eq("id", debate.id);
}

async function seedDebate(definition) {
  await deleteDebateByTitle(definition.title);

  const categoryId = await getOrCreateCategory(definition.category);
  const [userA, userB] = await Promise.all(
    definition.participants.map((participant) => getOrCreateUser(participant)),
  );

  const { data: debate, error: debateError } = await supabase
    .from("debates")
    .insert({
      title: definition.title,
      category_id: categoryId,
      status: "pending",
      max_turn_time: 180,
      max_message_length: 500,
    })
    .select("id")
    .single();

  if (debateError) throw new Error(`Debat: ${debateError.message}`);

  const { error: participantsError } = await supabase.from("debate_participants").insert([
    { debate_id: debate.id, user_id: userA, role: "participant", position: 1 },
    { debate_id: debate.id, user_id: userB, role: "participant", position: 2 },
  ]);

  if (participantsError) throw new Error(`Participants: ${participantsError.message}`);

  const { error: activateError } = await supabase
    .from("debates")
    .update({
      status: "active",
      started_at: new Date().toISOString(),
      turn_user_id: userA,
      current_turn_number: 5,
    })
    .eq("id", debate.id);

  if (activateError) throw new Error(`Activation debat: ${activateError.message}`);

  const messageRows = definition.messages.map((content, index) => {
    const turnNumber = Math.floor(index / 2) + 1;
    const userId = index % 2 === 0 ? userA : userB;
    return {
      debate_id: debate.id,
      user_id: userId,
      content,
      turn_number: turnNumber,
      created_at: new Date(Date.now() - (definition.messages.length - index) * 60_000).toISOString(),
    };
  });

  const { error: messagesError } = await supabase.from("messages").insert(messageRows);
  if (messagesError) throw new Error(`Messages: ${messagesError.message}`);

  const viewRows = Array.from({ length: definition.views }, (_, index) => ({
    debate_id: debate.id,
    session_id: `seed-view-${debate.id}-${index}`,
    created_at: new Date().toISOString(),
  }));

  const { error: viewsError } = await supabase.from("debate_views").insert(viewRows);
  if (viewsError) throw new Error(`Vues: ${viewsError.message}`);

  console.log(`Debat seed: "${definition.title}" (${messageRows.length} messages)`);
}

async function main() {
  console.log("Seed des debats en cours...");
  for (const definition of SEED_DEBATES) {
    await seedDebate(definition);
  }
  console.log("Seed termine: 2 debats avec 10 messages chacun.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
