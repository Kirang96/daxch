"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Bot, PlugZap, Shield, Trash2, User } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge, Disclaimer, GlassCard, AlertBanner } from "@/components/daxch/primitives";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { UserSettings } from "@/types";

export default function SettingsPage() {
  const tabs = ["Profile", "AI", "Notifications", "Broker", "Security", "Delete account"] as const;
  type Tab = (typeof tabs)[number];
  const [tab, setTab] = useState<Tab>("Profile");
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [status, setStatus] = useState("");
  const [brokerStatus, setBrokerStatus] = useState<{ connected: boolean; broker?: string } | null>(null);

  const refresh = async () => {
    try {
      const [settingsData, brokerData] = await Promise.all([
        api.get<UserSettings>("/settings"),
        api.get<{ connected: boolean; broker?: string }>("/broker/connection-status")
      ]);
      setSettings(settingsData);
      setBrokerStatus(brokerData);
      setStatus("");
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const updateProfile = async () => {
    if (!settings) return;
    try {
      await api.patch("/settings/profile", {
        profile_name: settings.profile_name,
        timezone: settings.timezone,
        preferred_currency: settings.preferred_currency
      });
      await refresh();
      setStatus("Profile saved.");
    } catch (err) {
      logger.error("Failed to save profile", { page: "settings", message: (err as Error).message });
      setStatus((err as Error).message);
    }
  };

  const updatePreferences = async () => {
    if (!settings) return;
    try {
      await api.patch("/settings/preferences", {
        notification_preferences: settings.notification_preferences,
        security_preferences: settings.security_preferences,
        api_connections: settings.api_connections
      });
      await refresh();
      setStatus("Preferences saved.");
    } catch (err) {
      logger.error("Failed to save preferences", { page: "settings", message: (err as Error).message });
      setStatus((err as Error).message);
    }
  };

  const updateAiModel = async () => {
    if (!settings) return;
    try {
      await api.patch("/settings/ai-model", { model: settings.preferred_ai_model });
      await refresh();
      setStatus("AI model saved.");
    } catch (err) {
      logger.error("Failed to save AI model", { page: "settings", message: (err as Error).message });
      setStatus((err as Error).message);
    }
  };

  const toggleNotification = (key: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      notification_preferences: {
        ...settings.notification_preferences,
        [key]: !Boolean(settings.notification_preferences[key])
      }
    });
  };

  const notificationRows: Array<[string, string, boolean?]> = [
    ["Agent conclusion updates", "agent_conclusion_updates"],
    ["Daily digest email", "daily_digest_email"]
  ];

  return (
    <AppShell title="Settings" subtitle="Control profile, security, broker connectivity, and account preferences.">
      {status && <p className="mb-4 rounded-xl border border-border/20 bg-background p-3 text-sm text-muted-foreground">{status}</p>}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border/20 bg-background p-1 text-xs">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5",
              t === tab ? "bg-primary/12 font-semibold text-primary ring-1 ring-primary/20" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Profile" && (
        <GlassCard>
          <div className="mb-4 flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4 text-primary" /> Profile
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Full name"
              value={settings?.profile_name || ""}
              onChange={(value) => settings && setSettings({ ...settings, profile_name: value })}
            />
            <Field label="Email" value="(managed by auth)" onChange={() => {}} disabled />
            <Field
              label="Timezone"
              value={settings?.timezone || ""}
              onChange={(value) => settings && setSettings({ ...settings, timezone: value })}
            />
            <Field
              label="Preferred currency"
              value={settings?.preferred_currency || "INR"}
              onChange={(value) => settings && setSettings({ ...settings, preferred_currency: value })}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={updateProfile}>Save profile</Button>
          </div>
        </GlassCard>
      )}

      {tab === "AI" && (
        <GlassCard>
          <div className="mb-4 flex items-center gap-2 text-sm font-medium">
            <Bot className="h-4 w-4 text-primary" /> AI model
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Choose the OpenAI model used for research, analysis, and monitoring agents.
          </p>
          {!settings?.ai_model_can_change && (
            <AlertBanner variant="info" className="mb-4 text-xs">
              Starter plans use GPT-4o Mini. Pro and Ultra can choose premium models (higher unit usage).{" "}
              <Link href="/subscription" className="font-medium text-primary underline-offset-2 hover:underline">
                Upgrade to Pro
              </Link>{" "}
              to switch between models.
            </AlertBanner>
          )}
          <div className="space-y-3">
            {settings?.ai_model_options.map((option) => {
              const selected = settings.preferred_ai_model === option.id;
              const disabled = !settings.ai_model_can_change;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    settings.ai_model_can_change &&
                    setSettings({ ...settings, preferred_ai_model: option.id })
                  }
                  className={
                    selected
                      ? "w-full rounded-sm border border-primary/30 bg-primary/10 p-4 text-left ring-1 ring-primary/20"
                      : "w-full rounded-xl border border-border/15 bg-muted/60 p-4 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{option.label}</div>
                    {selected && (
                      <Badge variant="success">Active</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
                </button>
              );
            })}
          </div>
          {settings?.ai_model_can_change && (
            <div className="mt-4 flex justify-end">
              <Button onClick={updateAiModel}>Save AI model</Button>
            </div>
          )}
        </GlassCard>
      )}

      {tab === "Notifications" && (
        <GlassCard>
          <div className="mb-4 flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </div>
          <div className="space-y-3">
            <AlertBanner variant="info" className="text-xs">
              Push notifications require the mobile app (coming soon). In-app notifications always appear in your feed.
            </AlertBanner>
            {notificationRows.map(([label, key]) => (
              <div key={label as string} className="flex items-center justify-between rounded-xl border border-border/15 bg-muted/60 p-3 text-sm">
                <span>{label}</span>
                <span
                  onClick={() => toggleNotification(key)}
                  className={Boolean(settings?.notification_preferences?.[key]) ? "cursor-pointer rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground" : "cursor-pointer rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"}
                >
                  {Boolean(settings?.notification_preferences?.[key]) ? "On" : "Off"}
                </span>
              </div>
            ))}
            <div className="flex justify-end">
              <Button variant="secondary" onClick={updatePreferences}>
                Save notification preferences
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {tab === "Broker" && (
        <GlassCard>
          <div className="mb-4 flex items-center gap-2 text-sm font-medium">
            <PlugZap className="h-4 w-4 text-primary" /> Broker connection
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Upstox", brokerStatus?.connected ? "Connected" : "Not connected", brokerStatus?.connected ? "success" : "warning"],
              ["Zerodha", "Coming soon", "neutral"],
              ["Angel One", "Coming soon", "neutral"],
              ["Groww", "Coming soon", "neutral"]
            ].map(([name, status, kind]) => (
              <div key={name as string} className="rounded-xl border border-border/15 bg-muted/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{name}</div>
                  <Badge variant={kind === "success" ? "success" : kind === "warning" ? "warning" : "neutral"}>
                    {status}
                  </Badge>
                </div>
                {name === "Upstox" && (
                  <div className="mt-3 flex gap-2">
                    <Link href="/broker" className="rounded-lg border border-border/20 bg-background px-3 py-1.5 text-xs hover:bg-muted">
                      Manage
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {tab === "Security" && (
        <GlassCard>
          <div className="mb-4 flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4 text-primary" /> Security
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-border/15 bg-muted/60 p-4">
              <div className="text-sm font-medium">Passwordless sign-in</div>
              <div className="mt-1 text-xs text-muted-foreground">Magic-link authentication enabled for this account.</div>
            </div>
            <div className="rounded-xl border border-border/15 bg-muted/60 p-4">
              <div className="text-sm font-medium">Session control</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Auto logout after inactivity: {String(settings?.security_preferences?.auto_logout_hours || 24)}h.
              </div>
            </div>
            <div className="rounded-xl border border-border/15 bg-muted/60 p-4">
              <div className="text-sm font-medium">Device activity</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Last profile update: {settings?.updated_at ? new Date(settings.updated_at).toLocaleString() : "Not available"}.
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {tab === "Delete account" && (
        <GlassCard className="border-red-300/60 bg-red-50">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-red-900">
            <Trash2 className="h-4 w-4" /> Danger zone
          </div>
          <p className="text-sm text-red-950">
            Deleting your account is irreversible. This action removes profile data, watchlists, and local settings.
          </p>
          <div className="mt-4 flex justify-end">
            <Button variant="danger" disabled title="Account deletion is not yet available">
              Delete account permanently
            </Button>
          </div>
        </GlassCard>
      )}

      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground/80">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-border/20 bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}

