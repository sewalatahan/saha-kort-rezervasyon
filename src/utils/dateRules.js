export function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function getWeekRange(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

export function getMaxTenisDate() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  return date.toISOString().slice(0, 10);
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