import type { Meta, StoryObj } from '@nuxtjs/storybook'
import Component from './DownloadAnalytics.vue'
import type { WeeklyDownloadPoint } from '~/composables/useCharts'

const meta = {
  component: Component,
  argTypes: {
    weeklyDownloads: {
      control: { type: 'object' },
      description: 'Array of weekly download data points for single package mode',
      table: {
        type: { summary: 'WeeklyDownloadPoint[]' },
        defaultValue: { summary: 'undefined' },
      },
    },
    inModal: {
      control: { type: 'boolean' },
      description: 'Whether the component is rendered within a modal',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    packageName: {
      control: { type: 'text' },
      description: 'Package name for single package mode (backward compatible)',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'undefined' },
      },
    },
    packageNames: {
      control: { type: 'object' },
      description: 'Array of package names for multi-package comparison mode',
      table: {
        type: { summary: 'string[]' },
        defaultValue: { summary: 'undefined' },
      },
    },
    createdIso: {
      control: { type: 'text' },
      description: 'ISO date string when the package was created (optional)',
      table: {
        type: { summary: 'string | null' },
        defaultValue: { summary: 'null' },
      },
    },
  },
} satisfies Meta<typeof Component>

export default meta
type Story = StoryObj<typeof meta>

// Sample data for single package mode
const sampleWeeklyDownloads: WeeklyDownloadPoint[] = [
  {
    downloads: 1500,
    weekKey: '2024-W01',
    weekStart: '2024-01-01',
    weekEnd: '2024-01-07',
    timestampStart: 1704067200000,
    timestampEnd: 1704672000000,
  },
  {
    downloads: 2100,
    weekKey: '2024-W02',
    weekStart: '2024-01-08',
    weekEnd: '2024-01-14',
    timestampStart: 1704672000000,
    timestampEnd: 1705276800000,
  },
  {
    downloads: 1800,
    weekKey: '2024-W03',
    weekStart: '2024-01-15',
    weekEnd: '2024-01-21',
    timestampStart: 1705276800000,
    timestampEnd: 1705881600000,
  },
  {
    downloads: 2300,
    weekKey: '2024-W04',
    weekStart: '2024-01-22',
    weekEnd: '2024-01-28',
    timestampStart: 1705881600000,
    timestampEnd: 1706486400000,
  },
  {
    downloads: 2800,
    weekKey: '2024-W05',
    weekStart: '2024-01-29',
    weekEnd: '2024-02-04',
    timestampStart: 1706486400000,
    timestampEnd: 1707091200000,
  },
]

export const Default: Story = {
  args: {},
}

export const SinglePackageWithData: Story = {
  args: {
    packageName: 'vue',
    weeklyDownloads: sampleWeeklyDownloads,
    createdIso: '2014-02-25T00:00:00.000Z',
  },
}

export const MultiPackageMode: Story = {
  args: {
    packageNames: ['vue', 'react', 'svelte'],
    createdIso: null,
  },
}

export const InModal: Story = {
  args: {
    packageName: 'vue',
    weeklyDownloads: sampleWeeklyDownloads,
    inModal: true,
    createdIso: '2014-02-25T00:00:00.000Z',
  },
}
