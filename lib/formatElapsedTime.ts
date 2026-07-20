export function formatElapsedTime(fromIso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60000));

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
  if (!iso) {
    return "-";
  }

  return new Intl.DateTimeFormat("ar-IQ", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Baghdad",
  }).format(new Date(iso));
}
