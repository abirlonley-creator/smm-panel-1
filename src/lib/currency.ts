/**
 * Currency utility for AuraSMM.
 * Standardizes display of Indian Rupees (₹ / INR) across the platform.
 */

export const DEFAULT_CURRENCY_SYMBOL = "₹";
export const DEFAULT_CURRENCY_CODE = "INR";

export function formatProviderBalance(
  amount: number | null | undefined,
  currencyCode: string | null | undefined
): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "Unavailable";
  if (!currencyCode || !/^[A-Z]{3}$/.test(currencyCode)) {
    return `${amount.toLocaleString("en-IN", { maximumFractionDigits: 15 })} ${currencyCode || ""}`.trim();
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 15,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("en-IN", { maximumFractionDigits: 15 })} ${currencyCode}`;
  }
}

export function formatCurrency(
  amount: number | string | null | undefined,
  decimals: number = 2,
  currencyCode: string = DEFAULT_CURRENCY_CODE
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  if (!Number.isFinite(num)) return `${DEFAULT_CURRENCY_SYMBOL}0.00`;

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch {
    return `${num.toFixed(decimals)} ${currencyCode}`;
  }
}

export function formatRate(ratePer1000: number | string, decimals: number = 2): string {
  const num = typeof ratePer1000 === "string" ? parseFloat(ratePer1000) : (ratePer1000 ?? 0);
  return `${DEFAULT_CURRENCY_SYMBOL}${num.toFixed(decimals)}/1k`;
}
