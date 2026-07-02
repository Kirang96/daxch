export type ExchangeTradeStage =
  | "awaiting_approval"
  | "rejected"
  | "approved_not_sent"
  | "sending"
  | "sent_pending"
  | "open_on_exchange"
  | "partially_filled"
  | "filled"
  | "failed"
  | "cancelled";

export type ExchangeTradeStageInfo = {
  stage: ExchangeTradeStage;
  label: string;
  description: string;
  variant: "success" | "warning" | "danger" | "primary" | "neutral";
};

type OrderLike = {
  status: string;
  broker_order_id?: string | null;
  quantity: number;
  filled_quantity?: number;
  broker_status?: string | null;
};

type DecisionLike = {
  decision_type: string;
  confirmation_status: string;
};

type LiveLike = {
  broker_status: string;
  filled_quantity: number;
  pending_quantity: number;
} | null | undefined;

const FILLED_STATUSES = new Set(["complete", "filled", "trade_complete"]);
const OPEN_STATUSES = new Set(["open", "pending", "trigger pending", "modified"]);
const FAILED_STATUSES = new Set(["rejected", "failed"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled"]);

export function resolveExchangeTradeStage(
  decision: DecisionLike,
  order: OrderLike | null | undefined,
  live?: LiveLike
): ExchangeTradeStageInfo {
  if (!order) {
    if (decision.decision_type === "initial_entry") {
      return {
        stage: "approved_not_sent",
        label: "Entry confirmed",
        description: "Your limit entry was confirmed — sending to the exchange.",
        variant: "primary",
      };
    }
    if (decision.confirmation_status === "pending") {
      return {
        stage: "awaiting_approval",
        label: "Awaiting your approval",
        description: "AI suggested an action — approve it to send an order to the exchange.",
        variant: "warning",
      };
    }
    if (decision.confirmation_status === "rejected") {
      return {
        stage: "rejected",
        label: "Rejected",
        description: "You rejected this suggestion. No order was sent.",
        variant: "neutral",
      };
    }
    if (decision.decision_type === "hold") {
      return {
        stage: "filled",
        label: "Hold — no trade",
        description: "AI suggested holding. No exchange order was created.",
        variant: "neutral",
      };
    }
    return {
      stage: "approved_not_sent",
      label: "Approved — no order record",
      description: "Approved but no broker order was created.",
      variant: "warning",
    };
  }

  const brokerStatus = (live?.broker_status ?? order.broker_status ?? "").toLowerCase();
  const internalStatus = order.status.toLowerCase();
  const filledQty = live?.filled_quantity ?? order.filled_quantity ?? 0;
  const pendingQty = live?.pending_quantity ?? Math.max(0, order.quantity - filledQty);

  if (internalStatus === "failed" || FAILED_STATUSES.has(brokerStatus)) {
    return {
      stage: "failed",
      label: "Failed on exchange",
      description: "The broker rejected or could not complete this order.",
      variant: "danger",
    };
  }

  if (internalStatus === "cancelled" || CANCELLED_STATUSES.has(brokerStatus)) {
    return {
      stage: "cancelled",
      label: "Cancelled",
      description: "This order was cancelled before completion.",
      variant: "warning",
    };
  }

  if (FILLED_STATUSES.has(brokerStatus) || (filledQty > 0 && pendingQty === 0 && order.broker_order_id)) {
    return {
      stage: "filled",
      label: "Filled on exchange",
      description: `${filledQty || order.quantity} shares executed on the exchange.`,
      variant: "success",
    };
  }

  if (filledQty > 0 && pendingQty > 0) {
    return {
      stage: "partially_filled",
      label: "Partially filled",
      description: `${filledQty} filled, ${pendingQty} still pending on the exchange.`,
      variant: "primary",
    };
  }

  if (order.broker_order_id && OPEN_STATUSES.has(brokerStatus)) {
    return {
      stage: "open_on_exchange",
      label: "Open on exchange",
      description: "Order is live on the exchange and waiting to fill.",
      variant: "primary",
    };
  }

  if (order.broker_order_id) {
    return {
      stage: "sent_pending",
      label: "Sent to exchange",
      description: "Order submitted to your broker — syncing fill status.",
      variant: "primary",
    };
  }

  if (internalStatus === "pending") {
    return {
      stage: "sending",
      label: "Sending to exchange",
      description: "Approved — placing order with your broker.",
      variant: "warning",
    };
  }

  if (internalStatus === "placed") {
    return {
      stage: "sent_pending",
      label: "Sent to exchange",
      description: "Order placed with broker. Refresh to sync latest fill status.",
      variant: "primary",
    };
  }

  return {
    stage: "approved_not_sent",
    label: "Not sent",
    description: "Order could not be confirmed with the exchange.",
    variant: "warning",
  };
}

export function tradeSideLabel(decisionType: string): { label: string; variant: "success" | "danger" | "neutral" } {
  if (decisionType === "initial_entry" || decisionType === "buy_more") return { label: "BUY", variant: "success" };
  if (decisionType === "sell") return { label: "SELL", variant: "danger" };
  return { label: "HOLD", variant: "neutral" };
}

export const LIFECYCLE_STEPS = [
  { key: "suggested", label: "AI signal" },
  { key: "approved", label: "Your approval" },
  { key: "sent", label: "Sent to exchange" },
  { key: "complete", label: "Fill status" },
] as const;

export function lifecycleStepIndex(stage: ExchangeTradeStage): number {
  switch (stage) {
    case "awaiting_approval":
    case "rejected":
      return 0;
    case "approved_not_sent":
    case "sending":
      return 1;
    case "sent_pending":
    case "open_on_exchange":
      return 2;
    case "partially_filled":
    case "filled":
    case "failed":
    case "cancelled":
      return 3;
    default:
      return 0;
  }
}
