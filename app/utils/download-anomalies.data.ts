import type { DownloadAnomaly } from './download-anomalies'

export const DOWNLOAD_ANOMALIES: DownloadAnomaly[] = [
  // vite rogue CI spike
  {
    packageName: 'vite',
    start: { date: '2025-08-04', weeklyDownloads: 33_913_132 },
    end: { date: '2025-09-08', weeklyDownloads: 38_665_727 },
  },
  {
    packageName: 'svelte',
    start: { date: '2022-11-15', weeklyDownloads: 75_233 },
    end: { date: '2022-11-30', weeklyDownloads: 69_524 },
  },
  {
    packageName: 'svelte',
    start: { date: '2023-06-19', weeklyDownloads: 107_491 },
    end: { date: '2023-06-22', weeklyDownloads: 112_432 },
  },
  {
    packageName: 'svelte',
    start: { date: '2023-11-18', weeklyDownloads: 59_611 },
    end: { date: '2023-11-21', weeklyDownloads: 150_680 },
  },
]
