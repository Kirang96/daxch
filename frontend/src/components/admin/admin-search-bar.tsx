"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";

export function AdminSearchBar() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = email.trim();
    if (!q) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.get<{ user_id: string; email: string }>(
        `/admin/users/lookup?email=${encodeURIComponent(q)}`
      );
      router.push(`/admin/users/${res.user_id}`);
    } catch {
      setError("No user found for that email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Search user by email…"
        className="h-9 w-56 rounded-lg border border-border/20 bg-background px-3 text-sm"
      />
      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? "…" : "Go"}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  );
}
