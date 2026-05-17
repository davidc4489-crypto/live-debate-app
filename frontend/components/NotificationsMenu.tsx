"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppNotification } from "@/lib/profile";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/follows-api";
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

    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
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
            {unreadCount > 0 ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void handleMarkAllRead()}
              >
                Tout marquer lu
              </button>
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
                  <Link
                    href={debateLink(notification)}
                    className="notifications-item-link"
                    onClick={() => void handleMarkRead(notification)}
                  >
                    <span className="notifications-item-title">{notification.title}</span>
                    <span className="notifications-item-message">{notification.message}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
