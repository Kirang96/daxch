import { resolveExchangeTradeStage } from "@/lib/exchange-trade-lifecycle";

describe("resolveExchangeTradeStage", () => {
  it("marks pending approval", () => {
    const info = resolveExchangeTradeStage(
      { decision_type: "buy_more", confirmation_status: "pending" },
      null
    );
    expect(info.stage).toBe("awaiting_approval");
    expect(info.label).toBe("Awaiting your approval");
  });

  it("marks sent to exchange", () => {
    const info = resolveExchangeTradeStage(
      { decision_type: "sell", confirmation_status: "approved" },
      {
        status: "placed",
        broker_order_id: "brk-1",
        quantity: 5,
        broker_status: "open",
      }
    );
    expect(info.stage).toBe("open_on_exchange");
    expect(info.label).toBe("Open on exchange");
  });

  it("marks filled", () => {
    const info = resolveExchangeTradeStage(
      { decision_type: "buy_more", confirmation_status: "approved" },
      {
        status: "placed",
        broker_order_id: "brk-2",
        quantity: 10,
        filled_quantity: 10,
        broker_status: "complete",
      },
      { broker_status: "complete", filled_quantity: 10, pending_quantity: 0 }
    );
    expect(info.stage).toBe("filled");
    expect(info.label).toBe("Filled on exchange");
  });
});
