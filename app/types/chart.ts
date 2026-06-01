export type ChartTimeGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type DateRangeFields = {
  startDate?: string
  endDate?: string
}

export type DailyDataPoint = { value: number; day: string; timestamp: number; hasAnomaly?: boolean }
export type WeeklyDataPoint = {
  value: number
  weekKey: string
  weekStart: string
  weekEnd: string
  timestampStart: number
  timestampEnd: number
  hasAnomaly?: boolean
}
export type MonthlyDataPoint = {
  value: number
  month: string
  timestamp: number
  hasAnomaly?: boolean
}
export type YearlyDataPoint = {
  value: number
  year: string
  timestamp: number
  hasAnomaly?: boolean
}

export type EvolutionData =
  | DailyDataPoint[]
  | WeeklyDataPoint[]
  | MonthlyDataPoint[]
  | YearlyDataPoint[]

type EvolutionOptionsBase = {
  startDate?: string
  endDate?: string
}

type EvolutionOptionsDay = EvolutionOptionsBase & {
  granularity: 'day'
}
type EvolutionOptionsWeek = EvolutionOptionsBase & {
  granularity: 'week'
  weeks?: number
}
type EvolutionOptionsMonth = EvolutionOptionsBase & {
  granularity: 'month'
  months?: number
}
type EvolutionOptionsYear = EvolutionOptionsBase & {
  granularity: 'year'
}

export type EvolutionOptions =
  | EvolutionOptionsDay
  | EvolutionOptionsWeek
  | EvolutionOptionsMonth
  | EvolutionOptionsYear

export type DailyRawPoint = { day: string; value: number }
