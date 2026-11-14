import type { DownloadAnomaly } from './download-anomalies'

export const DOWNLOAD_ANOMALIES: DownloadAnomaly[] = [
  // vite rogue CI spike
  {
    packageName: 'vite',
    start: { date: '2025-08-07', dailyDownloads: 6_200_000 },
    end: { date: '2025-09-02', dailyDownloads: 6_600_000 },
  },
  // svelte unexplained spikes to millions of downloads
  {
    packageName: 'svelte',
    start: { date: '2022-11-15', dailyDownloads: 75_233 },
    end: { date: '2022-11-30', dailyDownloads: 69_524 },
  },
  {
    packageName: 'svelte',
    start: { date: '2023-06-19', dailyDownloads: 107_491 },
    end: { date: '2023-06-22', dailyDownloads: 112_432 },
  },
  {
    packageName: 'svelte',
    start: { date: '2023-11-18', dailyDownloads: 59_611 },
    end: { date: '2023-11-21', dailyDownloads: 150_680 },
  },
  // solid-js unexplained spike to 1M downloads
  {
    packageName: 'solid-js',
    start: { date: '2024-12-22', dailyDownloads: 21_395 },
    end: { date: '2024-12-24', dailyDownloads: 28_308 },
  },
  // color-bridge unexplained single spike of 935 downloads
  {
    packageName: 'color-bridge',
    start: { date: '2026-07-09', dailyDownloads: 2 },
    end: { date: '2026-07-11', dailyDownloads: 2 },
  },
  // elm unexplained spike to 1M downloads
  {
    packageName: 'elm',
    start: { date: '2025-08-28', dailyDownloads: 5_500 },
    end: { date: '2025-09-02', dailyDownloads: 10_200 },
  },
  /**
   * NOTE:
   *  - please add new entries above this comment.
   *  - Add a comment before any new entry to explain the change
   **/
]
