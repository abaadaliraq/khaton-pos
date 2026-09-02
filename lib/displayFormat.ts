const baghdadLocale = "ar-IQ-u-nu-latn";
const baghdadTimeZone = "Asia/Baghdad";

function toValidDate(value?: string | number | Date | null) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatOrderNumber(orderNumber?: number | null) {
  if (!Number.isFinite(orderNumber)) {
    return "#------";
  }

  return `#${String(orderNumber).padStart(6, "0")}`;
}

export function formatOrderLabel(orderNumber?: number | null) {
  return `طلب ${formatOrderNumber(orderNumber)}`;
}

export function formatBaghdadDate(value?: string | number | Date | null) {
  const date = toValidDate(value);
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat(baghdadLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: baghdadTimeZone,
  }).format(date);
}

export function formatBaghdadTime(value?: string | number | Date | null) {
  const date = toValidDate(value);
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat(baghdadLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: baghdadTimeZone,
  }).format(date);
}

export function formatBaghdadDateTime(value?: string | number | Date | null) {
  const date = toValidDate(value);
  if (!date) {
    return "-";
  }

  return `${formatBaghdadDate(date)} ${formatBaghdadTime(date)}`;
}

export function getElapsedMinutes(fromIso?: string | null, now = Date.now()) {
  const date = toValidDate(fromIso);
  if (!date) {
    return null;
  }

  return Math.max(0, Math.floor((now - date.getTime()) / 60000));
}

export function getTimestamp(value?: string | number | Date | null) {
  return toValidDate(value)?.getTime() ?? null;
}
