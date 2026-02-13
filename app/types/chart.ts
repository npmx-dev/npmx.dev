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

type EvolutionOptionsBase = {
  startDate?: string
  endDate?: string
}

export type EvolutionOptionsDay = EvolutionOptionsBase & {
  granularity: 'day'
}
export type EvolutionOptionsWeek = EvolutionOptionsBase & {
  granularity: 'week'
  weeks?: number
}
export type EvolutionOptionsMonth = EvolutionOptionsBase & {
  granularity: 'month'
  months?: number
}
export type EvolutionOptionsYear = EvolutionOptionsBase & {
  granularity: 'year'
}

export type EvolutionOptions =
  | EvolutionOptionsDay
  | EvolutionOptionsWeek
  | EvolutionOptionsMonth
  | EvolutionOptionsYear

export type DailyRawPoint = { day: string; value: number }
