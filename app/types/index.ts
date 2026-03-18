import '#app'
import '#vue-router'
export * from './icon'
export * from './navigation'

declare module '#app' {
  interface PageMeta {
    /**
     * top margin in pixels for scrolling to an element
     * @default 70
     */
    scrollMargin?: number
    /**
     * preserve scroll position when only query params change on same path/hash
     */
    preserveScrollOnQuery?: boolean
  }
}
