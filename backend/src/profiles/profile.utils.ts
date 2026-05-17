export function buildDisplayName(user: {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
}): string {
  if (user.username?.trim()) return user.username.trim();
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (user.email) return user.email.split("@")[0];
  return "Utilisateur";
}
