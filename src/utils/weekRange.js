/** Local calendar week: Monday 00:00 through Sunday 23:59:59.999 */

export function startOfWeekMondayLocal(reference = new Date()) {
  const d = new Date(reference);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeekSundayLocal(reference = new Date()) {
  const start = startOfWeekMondayLocal(reference);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
