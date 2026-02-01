export function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0)
}

export function chunkIntoWeeks<T>(items: T[], weekSize = 7): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += weekSize) {
    result.push(items.slice(index, index + weekSize))
  }
  return result
}

export function buildWeeklyEvolutionFromDaily(
  daily: Array<{ day: string; downloads: number }>,
): Array<{ weekStart: string; weekEnd: string; downloads: number }> {
  const weeks = chunkIntoWeeks(daily, 7)
  return weeks.map(weekDays => {
    const weekStart = weekDays[0]?.day ?? ''
    const weekEnd = weekDays[weekDays.length - 1]?.day ?? ''
    const downloads = sum(weekDays.map(d => d.downloads))
    return { weekStart, weekEnd, downloads }
  })
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}
