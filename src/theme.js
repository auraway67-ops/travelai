export const COLORS = {
  ink: "#17211e",
  muted: "#778078",
  paper: "#f5f5f0",
  white: "#ffffff",
  lime: "#d9f06a",
  green: "#8ca336",
  line: "#e7e9e1",
  map: "#e8eddf",
};

export const ITEM_STYLES = {
  activity: { icon: "✳", color: "#758d2e", tint: "#eef3dc" },
  food: { icon: "◐", color: "#b07a3b", tint: "#f6ecdf" },
  transport: { icon: "↗", color: "#5f7a86", tint: "#e5edf0" },
  stay: { icon: "⌂", color: "#7a6a9a", tint: "#ece8f3" },
  free: { icon: "☼", color: "#8a9488", tint: "#eef0ea" },
};

export function formatMoney(amount, currency, decimals = 0) {
  const factor = 10 ** decimals;
  const value = Math.round((Number(amount) || 0) * factor) / factor;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${value.toFixed(decimals)} ${currency}`;
  }
}
