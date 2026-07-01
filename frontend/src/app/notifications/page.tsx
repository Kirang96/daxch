"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Bot, CandlestickChart, Newspaper, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge, Disclaimer, GlassCard, AlertBanner } from "@/components/daxch/primitives";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { NotificationEvent } from "@/types";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const query = filter === "All" ? "" : `?event_type=${filter.toLowerCase()}`;
      const data = await api.get<NotificationEvent[]>(`/notifications${query}`);
      setNotifications(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    refresh();
  }, [filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, NotificationEvent[]>();
    notifications.forEach((item) => {
      const dateKey = new Date(item.created_at).toDateString();
      map.set(dateKey, [...(map.get(dateKey) || []), item]);
    });
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
  }, [notifications]);

  const iconForType = (type: string) => {
    if (type === "agent") return Bot;
    if (type === "market") return TrendingUp;
    if (type === "risk") return AlertTriangle;
    if (type === "technical") return CandlestickChart;
    return Newspaper;
  };

  const badgeVariant = (type: string): "success" | "warning" | "neutral" | "primary" => {
    if (type === "agent") return "success";
    if (type === "risk") return "warning";
    if (type === "market" || type === "technical") return "primary";
    return "neutral";
  };

  const markRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`, {});
      await refresh();
    } catch (err) {
      logger.error("Failed to mark notification read", { page: "notifications", message: (err as Error).message });
      setError((err as Error).message);
    }
  };

  return (
    <AppShell title="Notifications" subtitle="Every action, alert, and insight in one chronological feed.">
      {error && <AlertBanner variant="error" className="mb-4">{error}</AlertBanner>}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border/20 bg-background p-1 text-xs">
        {["All", "Agent", "Risk", "System"].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5",
              filter === t ? "bg-primary/12 font-semibold text-primary ring-1 ring-primary/20" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {grouped.map((group) => (
          <GlassCard key={group.date}>
            <div className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">
              {new Date(group.date).toLocaleDateString()}
            </div>
            <div className="space-y-2">
              {group.items.map((item) => {
                const Icon = iconForType(item.event_type);
                return (
                  <div key={item.id} className="flex items-start gap-3 rounded-xl border border-border/15 bg-muted/60 p-3 hover:border-border/25">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border/20 bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={badgeVariant(item.event_type)}>{item.event_type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm">{item.title}</p>
                      <p className="break-words text-xs text-muted-foreground">{item.body}</p>
                    </div>
                    <button
                      onClick={() => markRead(item.id)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/20 bg-background text-muted-foreground hover:text-foreground"
                    >
                      <Bell className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        ))}
        {!grouped.length && (
          <GlassCard className="text-center">
            <p className="text-sm text-muted-foreground">No notifications yet. Create an agent to start receiving updates.</p>
            <Link
              href="/agents/new"
              className="mt-4 inline-flex rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-[oklch(0.15_0_0)]"
            >
              Create agent
            </Link>
          </GlassCard>
        )}
      </div>

      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}

