import type { Redis } from '@upstash/redis'

/** The Redis commands the collections index uses. */
export type IndexRedis = Pick<
  Redis,
  | 'get'
  | 'set'
  | 'del'
  | 'exists'
  | 'getdel'
  | 'mget'
  | 'sadd'
  | 'srem'
  | 'scard'
  | 'smembers'
  | 'zadd'
  | 'zrem'
  | 'zrange'
>

type ZMember = { score: number; member: string }

// Upstash round-trips values through JSON, so callers never share references with the store
const clone = <T>(value: T): T => structuredClone(value)

/**
 * An in-memory stand-in for the subset of Upstash Redis in `IndexRedis`, so local dev and tests
 * run the same index code as production. Not shared across serverless instances.
 */
export function createMemoryRedis(): IndexRedis {
  const strings = new Map<string, unknown>()
  const sets = new Map<string, Set<string>>()
  const zsets = new Map<string, Map<string, number>>()
  const del = (key: string) => [strings, sets, zsets].some(map => map.delete(key))

  const redis = {
    get: async (key: string) => (strings.has(key) ? clone(strings.get(key)) : null),
    set: async (key: string, value: unknown) => {
      strings.set(key, clone(value))
      return 'OK'
    },
    del: async (...keys: string[]) => keys.filter(del).length,
    exists: async (...keys: string[]) =>
      keys.filter(key => strings.has(key) || sets.has(key) || zsets.has(key)).length,
    getdel: async (key: string) => {
      const value = strings.has(key) ? clone(strings.get(key)) : null
      strings.delete(key)
      return value
    },
    mget: async (...keys: string[]) =>
      keys.map(key => (strings.has(key) ? clone(strings.get(key)) : null)),
    sadd: async (key: string, ...members: string[]) => {
      const set = sets.get(key) ?? new Set()
      sets.set(key, set)
      const before = set.size
      for (const member of members) set.add(member)
      return set.size - before
    },
    srem: async (key: string, ...members: string[]) =>
      members.filter(member => sets.get(key)?.delete(member)).length,
    scard: async (key: string) => sets.get(key)?.size ?? 0,
    smembers: async (key: string) => [...(sets.get(key) ?? [])],
    // Like Upstash, the options argument is optional and told apart from a member by `score`
    zadd: async (key: string, ...args: (ZMember | { nx?: boolean; xx?: boolean })[]) => {
      const opts = (args[0] && !('score' in args[0]) ? args.shift() : {}) as {
        nx?: boolean
        xx?: boolean
      }
      const members = args as ZMember[]
      const zset = zsets.get(key) ?? new Map<string, number>()
      zsets.set(key, zset)
      let added = 0
      for (const { score, member } of members) {
        const exists = zset.has(member)
        if ((opts.nx && exists) || (opts.xx && !exists)) continue
        if (!exists) added++
        zset.set(member, score)
      }
      return added
    },
    zrem: async (key: string, ...members: string[]) =>
      members.filter(member => zsets.get(key)?.delete(member)).length,
    // Score order, ties by member, as Redis does; `stop` is inclusive
    zrange: async (key: string, start: number, stop: number, opts?: { rev?: boolean }) => {
      const sorted = [...(zsets.get(key) ?? [])]
        .sort(([a, sa], [b, sb]) => sa - sb || (a < b ? -1 : a > b ? 1 : 0))
        .map(([member]) => member)
      if (opts?.rev) sorted.reverse()
      return sorted.slice(start, stop + 1)
    },
  }
  return redis as unknown as IndexRedis
}
