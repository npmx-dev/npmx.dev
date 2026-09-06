export type EventKind = 'meetup' | 'theatre' | 'meeting' | 'conference' | 'talk'
export type EventMode = 'inperson' | 'virtual' | 'hybrid'
export type EventStatus = 'scheduled' | 'planned' | 'cancelled' | 'postponed' | 'rescheduled'

export interface Attendee {
  name: string
  handle?: string
  did?: string
  avatar?: string
}

export interface EventHost {
  name: string
  uri?: string
}

export interface Speaker {
  name: string
  handle?: string
  did?: string
  avatar?: string
}

export interface Talk {
  id: string
  title: string
  abstract?: string
  speakers: Speaker[]
  startsAt?: string
  watchUrl?: string
  slidesUrl?: string
  pdfUrl?: string
}

export interface EventLocation {
  name?: string
  locality?: string
  country?: string
  lat?: string
  lon?: string
}

export interface EventLink {
  uri: string
  name?: string
}

export interface GalleryImage {
  url: string
  alt?: string
}

export interface EventSummary {
  slug: string
  name: string
  description?: string
  kind: EventKind
  mode: EventMode
  status: EventStatus
  startsAt: string
  endsAt?: string
  cover?: string
  location?: EventLocation
  tags: string[]
  attendees: Attendee[]
  attendeeCount: number
}

export interface EventDetail extends EventSummary {
  descriptionHtml?: string
  hosts: EventHost[]
  scheduleImage?: string
  schedule?: Array<{ time: string; label: string }>
  links: EventLink[]
  registerUrl?: string
  bskyPostUrl?: string
  talks: Talk[]
  gallery?: GalleryImage[]
}
