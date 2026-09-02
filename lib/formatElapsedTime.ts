import { formatBaghdadTime, getElapsedMinutes } from "@/lib/displayFormat";

export function formatElapsedTime(fromIso: string, now = Date.now()) {
  const minutes = getElapsedMinutes(fromIso, now);

  if (minutes === null) {
    return "-";
  }

  if (minutes < 1) {
    return "الآن";
  }

  if (minutes === 1) {
    return "منذ دقيقة";
  }

  if (minutes < 11) {
    return `منذ ${minutes} دقائق`;
  }

  if (minutes < 60) {
    return `منذ ${minutes} دقيقة`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  return restMinutes ? `منذ ${hours}س ${restMinutes}د` : `منذ ${hours} ساعة`;
}

export function formatKitchenClock(iso?: string) {
  return formatBaghdadTime(iso);
}
