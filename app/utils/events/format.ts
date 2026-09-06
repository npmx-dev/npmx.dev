function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function formatEventDateRange(startsAt: string, endsAt?: string, locale = 'en'): string {
  const start = new Date(startsAt)
  const end = endsAt ? new Date(endsAt) : undefined

  const day = (d: Date) => new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(d)
  const dayMonth = (d: Date) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d)
  const full = (d: Date) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
  const time = (d: Date) =>
    new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d)

  if (!end || sameDay(start, end)) {
    const base = full(start)
    if (end && (start.getHours() !== end.getHours() || start.getMinutes() !== end.getMinutes())) {
      return `${base} · ${time(start)}–${time(end)}`
    }
    return base
  }

  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()

  if (sameMonth) return `${day(start)}–${full(end)}`
  if (sameYear) return `${dayMonth(start)} – ${full(end)}`
  return `${full(start)} – ${full(end)}`
}

export function isPastEvent(
  event: { startsAt: string; endsAt?: string },
  now = new Date(),
): boolean {
  const reference = event.endsAt ? new Date(event.endsAt) : new Date(event.startsAt)
  return reference.getTime() < now.getTime()
}
