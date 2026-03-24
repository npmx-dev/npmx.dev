import { TID_CLOCK_ID } from './constants'
import * as TID from '@atcute/tid'

const ONE_DAY_MILLISECONDS = 86400000
const MS_TO_MICROSECONDS = 1000

// A very simple hasher to get an offset for blog posts on the same day
const simpleHash = (str: string): number => {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) >>> 0
  }
  return h
}

// Parse date from frontmatter, add slug-path entropy for same-date collision resolution
export const generateBlogTID = (dateString: string, slug: string): string => {
  let timestamp = Date.parse(dateString)

  if (timestamp % ONE_DAY_MILLISECONDS === 0) {
    const offset = simpleHash(slug) % 1000000
    timestamp += offset
  }

  // Clock id(3) needs to be the same everytime to get the same TID from a timestamp
  return TID.create(timestamp * MS_TO_MICROSECONDS, TID_CLOCK_ID)
}

// Using our release date as the tid for the publication
export const npmxPublicationRkey = () =>
  TID.create(Date.parse('2026-03-03') * MS_TO_MICROSECONDS, TID_CLOCK_ID)
