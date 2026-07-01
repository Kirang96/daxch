"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Bot,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Plug,
  Settings,
  Star,
  Wallet,
  X
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/daxch/logo";
import { AlertBanner } from "@/components/daxch/primitives";
import { NotificationEvent, Subscription, UserSettings, AiUnitsQuota } from "@/types";

type AppShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

type NavLink = {
  href: string;
  label: string;
  icon: typeof Bell;
  exact?: boolean;
  badge?: number | string;
  warningBadge?: boolean;
};

const links: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/research", label: "Research", icon: FlaskConical },
  { href: "/broker", label: "Broker", icon: Plug },
  { href: "/subscription", label: "Subscription", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileName, setProfileName] = useState("Account");
  const [planLabel, setPlanLabel] = useState("No subscription");
  const [planTier, setPlanTier] = useState<"starter" | "pro" | "ultra" | "none">("none");
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [brokerConnected, setBrokerConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [aiUsageWarning, setAiUsageWarning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let cancelled = false;
    const loadShellContext = async () => {
      try {
        const [settings, subscription, unread, broker, aiQuota] = await Promise.all([
          api.get<UserSettings>("/settings"),
          api.get<Subscription | null>("/subscriptions/current"),
          api.get<NotificationEvent[]>("/notifications?only_unread=true&limit=200"),
          api.get<{ connected: boolean }>("/broker/connection-status"),
          api.get<AiUnitsQuota>("/ai-units/current").catch(() => null)
        ]);
        if (cancelled) {
          return;
        }
        setProfileName(settings.profile_name || "Account");
        const paid = subscription?.status === "active";
        setSubscriptionActive(paid);
        if (paid && subscription?.plan) {
          const tier = subscription.plan.toLowerCase() as "starter" | "pro" | "ultra";
          setPlanTier(tier === "starter" || tier === "pro" || tier === "ultra" ? tier : "none");
          setPlanLabel(`${subscription.plan.toUpperCase()} plan`);
        } else if (subscription?.status) {
          setPlanTier("none");
          setPlanLabel(`${subscription.plan?.toUpperCase() ?? "—"} · ${subscription.status}`);
        } else {
          setPlanTier("none");
          setPlanLabel("No subscription");
        }
        setBrokerConnected(broker.connected);
        setUnreadCount(unread.length);
        setAiUsageWarning(
          !!aiQuota?.has_active_subscription && aiQuota.percent_used >= 80 && aiQuota.total_remaining > 0
        );
      } catch (err) {
        logger.error("Failed to load app shell context", { page: "app-shell", message: (err as Error).message });
        if (!cancelled) {
          setUnreadCount(0);
        }
      }
    };
    loadShellContext();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const initials = profileName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "AC";
  const navLinks: NavLink[] = links.map((link) =>
    link.href === "/subscription" && aiUsageWarning ? { ...link, warningBadge: true } : link
  );

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    router.push(`/research?ticker=${encodeURIComponent(query.toUpperCase())}`);
  };

  const planBadgeClass =
    planTier === "ultra"
      ? "border-violet-300/40 bg-gradient-to-r from-violet-500/15 to-primary/15 text-violet-700"
      : planTier === "pro"
        ? "border-primary/30 bg-primary/10 text-primary"
        : planTier === "starter"
          ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-700"
          : "border-border/20 bg-muted text-muted-foreground";

  return (
    <div className="min-h-screen bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[520px] opacity-70" style={{ background: "var(--gradient-hero)" }} />

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/20 bg-white/80 px-4 py-3 backdrop-blur-xl md:hidden">
        <Logo />
        <button
          onClick={() => setOpen((s) => !s)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border/20 bg-muted text-foreground/60 hover:text-foreground"
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[240px] flex-col border-r border-border/12 bg-white/95 px-3 py-5 backdrop-blur-xl md:sticky md:top-0 md:flex md:h-screen",
            open ? "flex" : "hidden"
          )}
        >
          <div className="hidden md:block">
            <Logo />
          </div>
          <div className="flex items-center justify-between md:hidden">
            <Logo />
            <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg border border-border/20">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* New Agent CTA */}
          <Link
            href="/agents/new"
            onClick={() => setOpen(false)}
            className="mt-5 mb-3 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_4px_16px_-4px_oklch(0.52_0.22_277/0.4)] transition-all hover:brightness-110 hover:shadow-[0_6px_20px_-4px_oklch(0.52_0.22_277/0.5)]"
          >
            <Plus className="h-4 w-4" /> New Agent
          </Link>

          {/* Nav links */}
          <nav className="flex flex-col gap-0.5">
            {navLinks.map((link) => {
              const active = isActive(link.href, link.exact);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
                    active
                      ? "bg-primary/[0.08] text-primary font-medium"
                      : "text-foreground/60 hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      active ? "text-primary" : "text-foreground/40 group-hover:text-foreground/70"
                    )}
                  />
                  <span className="flex-1">{link.label}</span>
                  {link.badge != null && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      {link.badge}
                    </span>
                  )}
                  {link.warningBadge && (
                    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white" title="AI Units running low">
                      AI
                    </span>
                  )}
                  {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                </Link>
              );
            })}
          </nav>

          {/* User card */}
          <div className="mt-auto">
            <div className="rounded-xl border border-border/12 bg-muted/50 p-3.5">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-emerald-500 text-xs font-bold text-white shadow-sm">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{profileName}</div>
                  {subscriptionActive && planTier !== "none" ? (
                    <Link
                      href="/subscription"
                      className={cn(
                        "mt-1 inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-opacity hover:opacity-80",
                        planBadgeClass
                      )}
                    >
                      {planTier} plan
                    </Link>
                  ) : (
                    <div className="truncate text-xs text-muted-foreground">{planLabel}</div>
                  )}
                  <div className="mt-1 truncate text-[10px] text-muted-foreground">
                    {brokerConnected ? "Upstox connected" : "Broker not connected"}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={logout} className="mt-2 px-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              Log out
            </button>
          </div>
        </aside>

        {open && <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />}

        <main className="min-h-screen min-w-0 flex-1">
          {/* Top bar */}
          <div className="sticky top-0 z-20 hidden items-center gap-4 border-b border-border/12 bg-white/80 px-8 py-3.5 backdrop-blur-xl md:flex">
            <form className="relative w-full max-w-sm" onSubmit={handleSearch}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search stocks, agents, research..."
                className="w-full rounded-lg border border-border/15 bg-muted/60 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </form>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/notifications"
                className="relative grid h-9 w-9 place-items-center rounded-lg border border-border/15 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Page content */}
          <div className="px-5 py-6 md:px-8 md:py-8">
            {!subscriptionActive ? (
              <AlertBanner variant="warning" className="mb-6" title="Subscription required">
                Choose a plan to create agents and use monitoring features.{" "}
                <Link href="/subscription" className="font-medium text-primary underline">
                  View plans
                </Link>
              </AlertBanner>
            ) : null}
            <div className="mb-8 flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
              </div>
              {actions && <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
            </div>
            <div className="fade-up">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
