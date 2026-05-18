import { getAuthHeaders } from "./auth";
import { AppNotification, FollowedUser, ProfileFollowStats } from "./profile";

function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
}

function requireAuthHeaders(): Record<string, string> {
  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    throw new Error("Connectez-vous pour cette action");
  }
  return headers;
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join(", ");
    if (data.message) return data.message;
  } catch {
    // ignore
  }
  return "Une erreur est survenue";
}

export async function fetchFollowStats(userId: string): Promise<ProfileFollowStats> {
  const response = await fetch(`${getBackendUrl()}/users/${userId}/follow-stats`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<ProfileFollowStats>;
}

export async function followUser(userId: string): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/users/${userId}/follow`, {
    method: "POST",
    headers: requireAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function unfollowUser(userId: string): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/users/${userId}/follow`, {
    method: "DELETE",
    headers: requireAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function fetchFollowingList(
  userId: string,
): Promise<{ users: FollowedUser[]; isPrivate: boolean }> {
  const response = await fetch(`${getBackendUrl()}/users/${userId}/following`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<{ users: FollowedUser[]; isPrivate: boolean }>;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const response = await fetch(`${getBackendUrl()}/users/me/notifications`, {
    headers: requireAuthHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<AppNotification[]>;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const response = await fetch(
    `${getBackendUrl()}/users/me/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      headers: requireAuthHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/users/me/notifications/read-all`, {
    method: "PATCH",
    headers: requireAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const response = await fetch(
    `${getBackendUrl()}/users/me/notifications/${notificationId}`,
    {
      method: "DELETE",
      headers: requireAuthHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function deleteAllNotifications(): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/users/me/notifications`, {
    method: "DELETE",
    headers: requireAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}
