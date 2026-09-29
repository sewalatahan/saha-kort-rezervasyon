function getIstanbulDate(date = new Date()) {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateText, dayCount) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayCount);
  return date.toISOString().slice(0, 10);
}

export function getToday() {
  return getIstanbulDate();
}

export function getWeekRange(date = new Date()) {
  const currentDate = getIstanbulDate(date);
  const current = new Date(`${currentDate}T00:00:00Z`);
  const day = current.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = addDays(currentDate, diffToMonday);

  return {
    start,
    end: addDays(start, 6),
  };
}

export function getMaxTenisDate() {
  return addDays(getToday(), 1);
}

export function isDateAllowed(courtId, dateText) {
  const today = getToday();

  if (courtId === "tenis") {
    return dateText >= today && dateText <= getMaxTenisDate();
  }

  if (courtId === "salon") {
    const week = getWeekRange();
    return dateText >= week.start && dateText <= week.end;
  }

  return true;
}

export function getTenisDayType(date, time) {
  if (!date || !time) return "";

  const monthDay = date.slice(5);
  const hour = Number(time.slice(0, 2));
  const summer = monthDay >= "06-01" && monthDay <= "10-01";

  if (summer) {
    return hour >= 7 && hour <= 19 ? "gunduz" : "gece";
  }

  return hour >= 8 && hour <= 17 ? "gunduz" : "gece";
}