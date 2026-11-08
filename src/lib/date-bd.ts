/**
 * Bangladesh Standard Time (BST / UTC+6 / Asia/Dhaka) formatting utilities.
 * Ensures consistent, simple 12-hour time display across AuraSMM.
 */

export function formatBdTime(date: Date | string | number): string {
  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    const d = new Date(date);
    return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  }
}

export function formatBdDate(date: Date | string | number): string {
  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      timeZone: "Asia/Dhaka",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    const d = new Date(date);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  }
}

export function formatBdDateTime(date: Date | string | number): string {
  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "—";
    const dateStr = d.toLocaleDateString("en-US", {
      timeZone: "Asia/Dhaka",
      month: "short",
      day: "numeric",
    });
    const timeStr = d.toLocaleTimeString("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${dateStr}, ${timeStr}`;
  } catch {
    const d = new Date(date);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString([], { hour: "numeric", minute: "2-digit", hour12: true });
  }
}

export interface BdTimeComponents {
  year: string;
  month: string;
  day: string;
  isoDate: string;
  hour12: number;
  minute: number;
  dayPeriod: "AM" | "PM";
  fullDisplay: string;
}

export function getBdNowComponents(addMinutes = 0): BdTimeComponents {
  const targetDate = new Date(Date.now() + addMinutes * 60 * 1000);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const parts = formatter.formatToParts(targetDate);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";

  const month = getPart("month");
  const day = getPart("day");
  const year = getPart("year");
  let hour12 = parseInt(getPart("hour"), 10) || 12;
  const minute = parseInt(getPart("minute"), 10) || 0;
  const rawPeriod = (getPart("dayPeriod") || "AM").toUpperCase();
  const dayPeriod: "AM" | "PM" = rawPeriod.includes("PM") ? "PM" : "AM";

  if (hour12 > 12) hour12 = hour12 % 12 || 12;

  const isoDate = `${year}-${month}-${day}`;
  const minutePadded = String(minute).padStart(2, "0");

  return {
    year,
    month,
    day,
    isoDate,
    hour12,
    minute,
    dayPeriod,
    fullDisplay: `${hour12}:${minutePadded} ${dayPeriod}`,
  };
}

/**
 * Constructs an ISO string with +06:00 offset from 12-hour Bangladesh time inputs
 */
export function buildBdIsoString(
  dateStr: string,
  hour12: number,
  minute: number,
  dayPeriod: "AM" | "PM"
): string {
  let hour24 = hour12 % 12;
  if (dayPeriod === "PM") {
    hour24 += 12;
  }
  const hStr = String(hour24).padStart(2, "0");
  const mStr = String(minute).padStart(2, "0");
  return `${dateStr}T${hStr}:${mStr}:00+06:00`;
}

/**
 * Returns human-friendly relative time description in Bangladesh Time
 */
export function getBdScheduleSummary(
  dateStr: string,
  hour12: number,
  minute: number,
  dayPeriod: "AM" | "PM"
): { label: string; isValid: boolean; diffMinutes: number } {
  try {
    const isoString = buildBdIsoString(dateStr, hour12, minute, dayPeriod);
    const targetTime = new Date(isoString).getTime();
    const now = Date.now();
    const diffMinutes = Math.round((targetTime - now) / 60000);

    const mStr = String(minute).padStart(2, "0");
    const timeFormatted = `${hour12}:${mStr} ${dayPeriod}`;

    const bdNow = getBdNowComponents();
    let dayLabel = dateStr;
    if (dateStr === bdNow.isoDate) {
      dayLabel = "Today";
    } else {
      const tomorrow = getBdNowComponents(24 * 60);
      if (dateStr === tomorrow.isoDate) {
        dayLabel = "Tomorrow";
      } else {
        const d = new Date(isoString);
        dayLabel = d.toLocaleDateString("en-US", { timeZone: "Asia/Dhaka", month: "short", day: "numeric" });
      }
    }

    if (diffMinutes < -1) {
      return {
        label: `⚠️ Selected time (${dayLabel} at ${timeFormatted}) is in the past. Please select a future time.`,
        isValid: false,
        diffMinutes,
      };
    }

    if (diffMinutes <= 1) {
      return {
        label: `🚀 Dispatches immediately (Now at ${timeFormatted} BD Time)`,
        isValid: true,
        diffMinutes,
      };
    }

    if (diffMinutes < 60) {
      return {
        label: `⏱️ Dispatches ${dayLabel} at ${timeFormatted} (in ${diffMinutes} minutes) Bangladesh Time 🇧🇩`,
        isValid: true,
        diffMinutes,
      };
    }

    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    const durationText = mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;

    return {
      label: `⏱️ Dispatches ${dayLabel} at ${timeFormatted} (in ${durationText}) Bangladesh Time 🇧🇩`,
      isValid: true,
      diffMinutes,
    };
  } catch {
    return {
      label: "Please pick a valid execution time.",
      isValid: false,
      diffMinutes: 0,
    };
  }
}
