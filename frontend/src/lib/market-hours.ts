const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const PRE_OPEN_START = 9 * 60;
const REGULAR_START = 9 * 60 + 15;
const REGULAR_END = 15 * 60 + 30;

export type MarketSession = "live" | "pre_open" | "closed";

export type MarketStatus = {
  session: MarketSession;
  label: string;
  detail: string;
};

/** India (IST) is UTC+5:30 year-round — compute clock without locale hour parsing quirks. */
function getIstClock(date: Date): { weekday: number; minutes: number } {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    weekday: ist.getUTCDay(),
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes()
  };
}

export function getNseMarketStatus(now = new Date()): MarketStatus {
  const { weekday, minutes } = getIstClock(now);
  const isWeekday = weekday >= 1 && weekday <= 5;

  if (!isWeekday) {
    return {
      session: "closed",
      label: "Market closed",
      detail: "NSE & BSE are closed on weekends. Regular session: Mon–Fri, 9:15 AM–3:30 PM IST."
    };
  }

  if (minutes >= REGULAR_START && minutes < REGULAR_END) {
    return {
      session: "live",
      label: "Market live",
      detail: "NSE & BSE regular session is open until 3:30 PM IST."
    };
  }

  if (minutes >= PRE_OPEN_START && minutes < REGULAR_START) {
    return {
      session: "pre_open",
      label: "Pre-market",
      detail: "Pre-open session is active. Regular trading opens at 9:15 AM IST."
    };
  }

  if (minutes < PRE_OPEN_START) {
    return {
      session: "closed",
      label: "Market closed",
      detail: "Regular session opens today at 9:15 AM IST."
    };
  }

  return {
    session: "closed",
    label: "Market closed",
    detail: "Regular session ended at 3:30 PM IST. Next session opens on the next trading day at 9:15 AM IST."
  };
}
