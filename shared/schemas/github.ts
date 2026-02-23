import * as v from 'valibot'

export const GitHubStarBodySchema = v.object({
  owner: v.string(),
  repo: v.string(),
})
