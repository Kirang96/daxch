import { api } from "@/lib/api";
import { useState } from "react";

function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type BrokerFundsResponse = {
  broker: string;
  available_margin: number;
  ledger_balance: number | null;
  currency: string;
  fetched_at: string;
};

export function BrokerFundsCheck({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [funds, setFunds] = useState<BrokerFundsResponse | null>(null);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const fetchFunds = async () => {
    setLoading(true);
    setError("");
    setDismissed(false);
    try {
      const response = await api.get<BrokerFundsResponse>("/broker/funds");
      setFunds(response);
    } catch (err) {
      setFunds(null);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => void fetchFunds()}
          disabled={loading}
          className="text-xs font-medium text-primary underline disabled:opacity-60"
        >
          {loading ? "Checking balance…" : "Check broker balance"}
        </button>
        {!dismissed && funds && (
          <div className="mt-2 rounded-lg border border-border/15 bg-background px-3 py-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <span>
                Available for trading: <strong>{formatInr(funds.available_margin)}</strong>
                {funds.ledger_balance != null && (
                  <span className="text-muted-foreground"> · Ledger {formatInr(funds.ledger_balance)}</span>
                )}
              </span>
              <button type="button" onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
                ×
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void fetchFunds()}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-border/20 px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
      >
        {loading ? "Fetching…" : "View available funds"}
      </button>
      {funds && (
        <p className="mt-2 text-sm">
          Available for trading: <strong>{formatInr(funds.available_margin)}</strong>
          {funds.ledger_balance != null && (
            <span className="text-muted-foreground"> · Ledger balance {formatInr(funds.ledger_balance)}</span>
          )}
          <span className="mt-1 block text-xs text-muted-foreground">
            As of {new Date(funds.fetched_at).toLocaleString()}
          </span>
        </p>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
