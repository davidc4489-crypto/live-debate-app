"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppNotification } from "@/lib/profile";
import {
  deleteAllNotifications,
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/follows-api";
import { getStoredAuth } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import { useAuthSession } from "@/lib/useAuthSession";

export function NotificationsMenu() {
  const { user } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((item) => !item.read).length;

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchNotifications();
        if (!cancelled) setItems(data);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const socket = getSocket();
    const subscribe = () => {
      const token = getStoredAuth()?.session.accessToken;
      if (token) socket.emit("subscribeUser", { accessToken: token });
    };

    const onNotificationsUpdated = () => {
      void load();
    };

    void load();
    subscribe();
    socket.on("notificationsUpdated", onNotificationsUpdated);
    socket.io.on("reconnect", subscribe);
    const interval = setInterval(() => void load(), 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      socket.off("notificationsUpdated", onNotificationsUpdated);
      socket.io.off("reconnect", subscribe);
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && user) {
      try {
        const data = await fetchNotifications();
        setItems(data);
      } catch {
        // ignore
      }
    }
  }

  async function handleMarkRead(notification: AppNotification) {
    if (notification.read) return;
    try {
      await markNotificationRead(notification.id);
      setItems((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
      );
    } catch {
      // ignore
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, read: true })));
    } catch {
      // ignore
    }
  }

  async function handleDelete(
    event: React.MouseEvent,
    notificationId: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await deleteNotification(notificationId);
      setItems((current) => current.filter((item) => item.id !== notificationId));
    } catch {
      // ignore
    }
  }

  async function handleDeleteAll() {
    if (items.length === 0) return;
    if (!window.confirm("Supprimer toutes vos notifications ?")) return;
    try {
      await deleteAllNotifications();
      setItems([]);
    } catch {
      // ignore
    }
  }

  if (!user) return null;

  function debateLink(notification: AppNotification) {
    const id = notification.roomId || notification.debateId;
    return id ? `/room/${id}` : "#";
  }

  return (
    <div className="notifications-wrap" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-ghost btn-sm notifications-btn"
        onClick={() => void handleOpen()}
        aria-expanded={open}
        aria-label="Notifications"
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 ? <span className="notifications-badge">{unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="notifications-panel" role="menu">
          <div className="notifications-panel-head">
            <strong>Notifications</strong>
            {items.length > 0 ? (
              <div className="notifications-panel-actions">
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void handleMarkAllRead()}
                  >
                    Tout marquer lu
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm notifications-delete-all"
                  onClick={() => void handleDeleteAll()}
                >
                  Tout supprimer
                </button>
              </div>
            ) : null}
          </div>

          {loading ? (
            <p className="muted notifications-empty">Chargement…</p>
          ) : items.length === 0 ? (
            <p className="muted notifications-empty">Aucune notification.</p>
          ) : (
            <ul className="notifications-list">
              {items.map((notification) => (
                <li
                  key={notification.id}
                  className={`notifications-item ${notification.read ? "read" : "unread"}`}
                >
                  <div className="notifications-item-row">
                    <Link
                      href={debateLink(notification)}
                      className="notifications-item-link"
                      onClick={() => void handleMarkRead(notification)}
                    >
                      <span className="notifications-item-title">{notification.title}</span>
                      <span className="notifications-item-message">{notification.message}</span>
                    </Link>
                    <button
                      type="button"
                      className="notifications-item-delete"
                      aria-label="Supprimer la notification"
                      title="Supprimer"
                      onClick={(event) => void handleDelete(event, notification.id)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
