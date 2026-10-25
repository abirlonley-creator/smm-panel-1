/**
 * Central Brand Configuration for AuraSMM
 * All consumer-facing branding, titles, metadata, receipt headers, and templates
 * must import and use this constant rather than hard-coding brand strings.
 */
export const BRAND = {
  name: "AuraSMM",
  shortName: "AuraSMM",
  tagline: "Minimalist SMM Panel & Growth Planner",
  description: "A clean, reliable SMM ordering platform with third-party provider API integration, an intelligent delivery scheduler, and transparent delivery previews.",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://aurasmm.com",
  currencySymbol: "₹",
  defaultCurrency: "INR",
  invoicePrefix: "AURA",
  walletName: "AuraSMM Wallet",
  receiptHeader: "AuraSMM Official Receipt",
  manifestName: "AuraSMM — Minimalist SMM Panel & Growth Planner",
  logoAlt: "AuraSMM Logo",
  supportEmail: "support@aurasmm.com",
  themeColor: "#252943",
  accentColor: "#3A4EFB",
  highlightColor: "#E3FF3B",
  backgroundColor: "#F8F9FD",
} as const;

export const BRAND_NAME = BRAND.name;
export default BRAND;
