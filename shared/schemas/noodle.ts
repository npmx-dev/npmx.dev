import * as v from 'valibot'

const NoodleAuthorSchema = v.object({
  name: v.string(),
  blueskyHandle: v.optional(v.string()),
})

const NoodleReferenceSchema = v.object({
  label: v.optional(v.string()),
  url: v.string(),
})

// Required: key, title, slug, date. Everything else is optional and the
// detail page only renders sections for fields that are filled in.
const NoodleSchema = v.object({
  key: v.string(),
  title: v.string(),
  slug: v.string(),
  date: v.string(),
  dateTo: v.optional(v.string()),
  // IANA timezone name, or "auto" for the visitor's local time.
  timezone: v.optional(v.string()),
  // When true, the npmx tagline is hidden while this noodle is active.
  tagline: v.optional(v.boolean()),
  occasion: v.optional(v.string()),
  description: v.optional(v.string()),
  // Public paths to variant images (draft / alternate takes), used by the lens carousel.
  variants: v.optional(v.array(v.string())),
  prUrl: v.optional(v.string()),
  authors: v.optional(v.array(NoodleAuthorSchema)),
  // External links (Wikipedia, NASA mission page, etc.) shown in the detail right panel.
  references: v.optional(v.array(NoodleReferenceSchema)),
  // Public path to the OG-image hero asset.
  posterImage: v.optional(v.string()),
  // Optional image rendered behind `posterImage` (e.g. a backdrop the wordmark sits on).
  posterBackdrop: v.optional(v.string()),
})

export type Noodle = v.InferOutput<typeof NoodleSchema>
