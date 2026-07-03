"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Bot,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  Star,
  Wallet,
  X
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { BrokerConnectionStatus, formatBrokerName, isBrokerHealthy } from "@/lib/broker-status";
import { scheduleSessionRefresh } from "@/lib/session";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/daxch/logo";
import { MarketLiveBadge } from "@/components/daxch/market-live-badge";
import { NotificationEvent, Subscription, UserSettings, AiUnitsQuota } from "@/types";

type AppShellProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
  children: ReactNode;
};

const NAV_MAIN = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/research", label: "Research", icon: FlaskConical },
  { href: "/guide", label: "How it works", icon: BookOpen }
];

const NAV_SECONDARY = [
  { href: "/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" as const },
  { href: "/broker", label: "Broker", icon: Link2 },
  { href: "/subscription", label: "Subscription", icon: CreditCard, warnKey: "ai" as const },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ title, subtitle, actions, eyebrow, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileName, setProfileName] = useState("Account");
  const [planTier, setPlanTier] = useState<"starter" | "pro" | "ultra" | "none">("none");
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [brokerStatus, setBrokerStatus] = useState<BrokerConnectionStatus | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [aiUsageWarning, setAiUsageWarning] = useState(false);
  const [aiUsagePct, setAiUsagePct] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    return scheduleSessionRefresh();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const hours = 24;
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        logout();
        router.replace("/login");
      }, hours * 60 * 60 * 1000);
    };
    const events = ["mousemove", "keydown", "click", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, resetIdle));
    resetIdle();
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      events.forEach((e) => window.removeEventListener(e, resetIdle));
    };
  }, [isAuthenticated, logout, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    const loadShellContext = async () => {
      try {
        const [settings, subscription, unread, broker, aiQuota, me] = await Promise.all([
          api.get<UserSettings>("/settings"),
          api.get<Subscription | null>("/subscriptions/current"),
          api.get<NotificationEvent[]>("/notifications?only_unread=true&limit=200"),
          api.get<BrokerConnectionStatus>("/broker/connection-status"),
          api.get<AiUnitsQuota>("/ai-units/current").catch(() => null),
          api.get<{ is_admin?: boolean }>("/auth/me").catch(() => null)
        ]);
        if (cancelled) return;

        setProfileName(settings.profile_name || "Account");
        const paid = subscription?.status === "active";
        setSubscriptionActive(paid);
        if (paid && subscription?.plan) {
          const tier = subscription.plan.toLowerCase() as "starter" | "pro" | "ultra";
          setPlanTier(tier === "starter" || tier === "pro" || tier === "ultra" ? tier : "none");
        } else {
          setPlanTier("none");
        }
        setBrokerStatus(broker);
        setUnreadCount(unread.length);
        const warn =
          !!aiQuota?.has_active_subscription && aiQuota.percent_used >= 80 && aiQuota.total_remaining > 0;
        setAiUsageWarning(warn);
        setAiUsagePct(aiQuota ? Math.round(aiQuota.percent_used) : 0);
        setIsAdmin(Boolean(me?.is_admin));
      } catch (err) {
        logger.error("Failed to load app shell context", { page: "app-shell", message: (err as Error).message });
        if (!cancelled) setUnreadCount(0);
      }
    };
    loadShellContext();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    const refreshBrokerStatus = async () => {
      try {
        const broker = await api.get<BrokerConnectionStatus>("/broker/connection-status");
        if (!cancelled) setBrokerStatus(broker);
      } catch (err) {
        logger.warn("Failed to refresh broker status", { page: "app-shell", message: (err as Error).message });
        if (!cancelled) setBrokerStatus({ connected: false });
      }
    };

    void refreshBrokerStatus();
    const interval = window.setInterval(() => void refreshBrokerStatus(), 5 * 60 * 1000);
    const onFocus = () => void refreshBrokerStatus();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [isAuthenticated, pathname]);

  const brokerHealthy = isBrokerHealthy(brokerStatus);
  const brokerSessionExpired = Boolean(brokerStatus?.connected && brokerStatus?.expired);
  const brokerLabel = formatBrokerName(brokerStatus?.broker);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const initials =
    profileName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "AC";

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    router.push(`/research?ticker=${encodeURIComponent(query.toUpperCase())}`);
  };

  const planLabel =
    planTier === "ultra" ? "Ultra" : planTier === "pro" ? "Pro" : planTier === "starter" ? "Starter" : null;

  return (
    <div className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)] antialiased">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[color:var(--ink)]/15 bg-[color:var(--paper)] px-4 py-3 md:hidden">
        <Logo />
        <button
          onClick={() => setOpen((s) => !s)}
          className="grid h-9 w-9 place-items-center border border-[color:var(--ink)]/20 bg-[color:var(--paper-3)]"
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </header>

      <div className="flex">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[264px] flex-col border-r border-[color:var(--ink)]/12 bg-[color:var(--paper-3)] px-5 py-6 md:sticky md:top-0 md:flex md:h-screen",
            open ? "flex" : "hidden md:flex"
          )}
        >
          <div className="flex items-center justify-between md:block">
            <Link href="/dashboard">
              <Logo />
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center border border-[color:var(--ink)]/20 md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Link
            href="/agents/new"
            onClick={() => setOpen(false)}
            className="btn-editorial mt-8 w-full"
          >
            <Plus className="h-3.5 w-3.5" /> New Agent
          </Link>

          <div className="mb-2 mt-8 px-1 font-mono text-[9px] font-medium uppercase tracking-[0.24em] text-[color:var(--ink-2)]/50">
            Monitor
          </div>
          <nav className="space-y-0.5">
            {NAV_MAIN.map((item) => (
              <NavRow
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={isActive(item.href, item.exact)}
                onClick={() => setOpen(false)}
              />
            ))}
          </nav>

          <div className="mb-2 mt-6 px-1 font-mono text-[9px] font-medium uppercase tracking-[0.24em] text-[color:var(--ink-2)]/50">
            Account
          </div>
          <nav className="flex-1 space-y-0.5">
            {NAV_SECONDARY.map((item) => (
              <NavRow
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={isActive(item.href)}
                badge={item.badgeKey === "notifications" && unreadCount > 0 ? unreadCount : undefined}
                warn={item.warnKey === "ai" && aiUsageWarning}
                onClick={() => setOpen(false)}
              />
            ))}
            {isAdmin && (
              <NavRow
                href="/admin"
                icon={Shield}
                label="Admin"
                active={pathname.startsWith("/admin")}
                onClick={() => setOpen(false)}
              />
            )}
          </nav>

          <div className="mt-6 space-y-3 border-t border-[color:var(--ink)]/12 pt-4">
            <Link
              href="/broker"
              className="flex items-center justify-between px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink-2)]/70 hover:text-[color:var(--ink)]"
            >
              <span>Broker</span>
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    brokerHealthy ? "pulse-ring bg-[color:var(--forest)]" : "bg-[color:var(--destructive)]"
                  )}
                />
                {brokerHealthy ? brokerLabel : brokerSessionExpired ? "Reconnect" : "Not connected"}
              </span>
            </Link>

            <div className="flex items-center gap-3 border border-[color:var(--ink)]/15 bg-[color:var(--paper)] p-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center border border-[color:var(--ink)] bg-[color:var(--paper-3)] font-mono text-[11px] font-bold text-[color:var(--ink)]">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-serif text-[13px] font-medium text-[color:var(--ink)]">{profileName}</div>
                <Link
                  href="/subscription"
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--forest)] hover:underline"
                >
                  {planLabel ? `${planLabel} plan` : "No plan"}
                </Link>
              </div>
              <button
                type="button"
                onClick={logout}
                aria-label="Log out"
                className="grid h-7 w-7 place-items-center text-[color:var(--ink-2)]/70 hover:text-[color:var(--destructive)]"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-30 bg-[color:var(--ink)]/20 md:hidden" onClick={() => setOpen(false)} />
        )}

        <main className="min-h-screen min-w-0 flex-1">
          <div className="sticky top-0 z-20 hidden items-center gap-4 border-b border-[color:var(--ink)]/12 bg-[color:var(--paper)]/95 px-8 py-4 backdrop-blur md:flex">
            <form className="relative w-full max-w-md" onSubmit={handleSearch}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-2)]/50" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search stocks, agents, research…"
                className="w-full border border-[color:var(--ink)]/20 bg-[color:var(--paper-3)] py-2 pl-9 pr-3 font-mono text-sm placeholder:text-[color:var(--ink-2)]/50 focus:border-[color:var(--ink)] focus:outline-none"
              />
            </form>

            <div className="ml-auto flex items-center gap-2">
              <MarketLiveBadge className="hidden lg:inline-flex" />
              <Link
                href="/notifications"
                className="relative grid h-9 w-9 place-items-center border border-[color:var(--ink)]/20 bg-[color:var(--paper-3)] text-[color:var(--ink-2)] hover:bg-[color:var(--paper-2)]"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--destructive)] px-1 font-mono text-[9px] font-bold text-[color:var(--paper)]">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {brokerSessionExpired && (
            <div className="border-b border-[color:var(--ink)]/10 bg-[color:var(--paper-2)] px-5 py-2.5 md:px-8">
              <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--ink-2)]">
                <AlertTriangle className="h-3.5 w-3.5 text-[color:oklch(0.55_0.14_55)]" />
                <span>
                  <strong className="text-[color:var(--ink)]">{brokerLabel} session expired.</strong> Reconnect to sync
                  orders and place trades.{" "}
                  <Link href="/broker" className="ml-1 underline underline-offset-4">
                    Reconnect →
                  </Link>
                </span>
              </div>
            </div>
          )}

          {(!subscriptionActive || aiUsageWarning) && (
            <div className="border-b border-[color:var(--ink)]/10 bg-[color:var(--paper-2)] px-5 py-2.5 md:px-8">
              <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--ink-2)]">
                <AlertTriangle className="h-3.5 w-3.5 text-[color:oklch(0.55_0.14_55)]" />
                {!subscriptionActive ? (
                  <span>
                    <strong className="text-[color:var(--ink)]">No active plan.</strong> New agent creation is paused
                    until you subscribe.{" "}
                    <Link href="/subscription" className="ml-1 underline underline-offset-4">
                      Choose a plan →
                    </Link>
                  </span>
                ) : (
                  <span>
                    <strong className="text-[color:var(--ink)]">AI Units at {aiUsagePct}%.</strong> Monitoring may
                    slow.{" "}
                    <Link href="/subscription" className="ml-1 underline underline-offset-4">
                      Top up →
                    </Link>
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="px-5 py-8 md:px-10 md:py-10">
            {(title || actions || eyebrow) && (
              <div className="mb-10 border-b border-[color:var(--ink)] pb-6">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                  <div className="min-w-0 pb-0.5">
                    {eyebrow && (
                      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-[color:var(--ink-2)]/60">
                        <span className="h-px w-6 bg-[color:var(--ink)]" />
                        {eyebrow}
                      </div>
                    )}
                    {title && (
                      <h1 className="text-balance font-serif text-3xl leading-[1.15] tracking-tight text-[color:var(--ink)] md:text-[42px] md:leading-[1.12]">
                        {title}
                      </h1>
                    )}
                    {subtitle && (
                      <p className="mt-2 text-sm text-[color:var(--ink-2)]/80 md:text-base">{subtitle}</p>
                    )}
                  </div>
                  {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
                </div>
              </div>
            )}
            <div className="fade-up">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

function NavRow({
  href,
  icon: Icon,
  label,
  active,
  badge,
  warn,
  onClick
}: {
  href: string;
  icon: typeof Bell;
  label: string;
  active?: boolean;
  badge?: number;
  warn?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2 text-sm transition-colors",
        active
          ? "bg-[color:var(--paper-2)] text-[color:var(--ink)]"
          : "text-[color:var(--ink-2)]/85 hover:bg-[color:var(--paper-2)]/60 hover:text-[color:var(--ink)]"
      )}
    >
      {active && <span className="absolute inset-y-1 left-0 w-[2px] bg-[color:var(--ink)]" />}
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {warn && <span className="h-1.5 w-1.5 rounded-full bg-[color:oklch(0.62_0.14_55)]" />}
      {badge != null && badge > 0 && (
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--ink)] px-1 font-mono text-[9px] font-bold text-[color:var(--paper)]">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
