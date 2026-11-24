/**
 * High-performance disposable/temporary email blocker.
 * Prevents automated account farming using throwaway email services.
 */
const BLOCKED_DOMAINS = new Set([
  "mailinator.com",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.biz",
  "guerrillamail.org",
  "sharklasers.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "trashmail.com",
  "trashmail.net",
  "dispostable.com",
  "nada.ltd",
  "getairmail.com",
  "mytemp.email",
  "throwawaymail.com",
  "fakemailgenerator.com",
  "emailondeck.com",
  "generator.email",
  "mohmal.com",
  "crazymailing.com",
  "tempail.com",
  "tmail.ws",
  "dropmail.me",
  "inboxkitten.com",
  "armyspy.com",
  "cuvox.de",
  "dayrep.com",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",
  "tinemail.com",
]);

export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes("@")) return true;
  const parts = email.toLowerCase().trim().split("@");
  if (parts.length !== 2) return true;
  const domain = parts[1];
  return BLOCKED_DOMAINS.has(domain);
}

export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const clean = email.trim();
  // RFC 5322 compliant regex for web applications
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(clean) && clean.length <= 254;
}
