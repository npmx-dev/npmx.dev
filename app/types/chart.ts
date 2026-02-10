export type ChartTimeGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type DateRangeFields = {
  startDate?: string
  endDate?: string
}

export type DailyDataPoint = { value: number; day: string; timestamp: number }
export type WeeklyDataPoint = {
  value: number
  weekKey: string
  weekStart: string
  weekEnd: string
  timestampStart: number
  timestampEnd: number
}
export type MonthlyDataPoint = { value: number; month: string; timestamp: number }
export type YearlyDataPoint = { value: number; year: string; timestamp: number }

export type EvolutionData =
  | DailyDataPoint[]
  | WeeklyDataPoint[]
  | MonthlyDataPoint[]
  | YearlyDataPoint[]
