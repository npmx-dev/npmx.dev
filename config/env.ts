// TODO(serhalp): Extract most of this module to https://github.com/unjs/std-env.

import * as process from 'node:process'
import Git from 'simple-git'
import { version as packageVersion } from '../package.json'
import { getNextVersion } from '../scripts/next-version'

/**
 * Environment variable `PULL_REQUEST` provided by Netlify.
 * @see {@link https://docs.netlify.com/build/configure-builds/environment-variables/#git-metadata}
 *
 * Environment variable `VERCEL_GIT_PULL_REQUEST_ID` provided by Vercel.
 * @see {@link https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_GIT_PULL_REQUEST_ID}
 *
 * Whether triggered by a GitHub PR
 */
const isPR = process.env.PULL_REQUEST === 'true' || !!process.env.VERCEL_GIT_PULL_REQUEST_ID

/**
 * Environment variable `REVIEW_ID` provided by Netlify.
 * @see {@link https://docs.netlify.com/configure-builds/environment-variables/#git-metadata}
 *
 * Environment variable `VERCEL_GIT_PULL_REQUEST_ID` provided by Vercel.
 * @see {@link https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_GIT_PULL_REQUEST_ID}
 *
 * Pull request number (if in a PR environment)
 */
const prNumber = process.env.REVIEW_ID || process.env.VERCEL_GIT_PULL_REQUEST_ID || null

/**
 * Environment variable `BRANCH` provided by Netlify.
 * @see {@link https://docs.netlify.com/build/configure-builds/environment-variables/#git-metadata}
 *
 * Environment variable `VERCEL_GIT_COMMIT_REF` provided by Vercel.
 * @see {@link https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_GIT_COMMIT_REF}
 *
 * Git branch
 */
const gitBranch = process.env.BRANCH || process.env.VERCEL_GIT_COMMIT_REF

/**
 * Whether this is the canary environment (main.npmx.dev).
 *
 * Detected as any non-PR Vercel deploy from the `main` branch
 * (which may receive `VERCEL_ENV === 'production'`, `'preview'`, or a
 * custom `'canary'` environment depending on the project configuration).
 *
 * @see {@link https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_ENV}
 */
export const isCanary =
  (process.env.VERCEL_ENV === 'production' ||
    process.env.VERCEL_ENV === 'preview' ||
    process.env.VERCEL_ENV === 'canary') &&
  gitBranch === 'main' &&
  !isPR

/**
 * Environment variable `CONTEXT` provided by Netlify.
 * `dev`, `production`, `deploy-preview`, `branch-deploy`, `preview-server`, or a branch name
 * @see {@link https://docs.netlify.com/build/configure-builds/environment-variables/#build-metadata}
 *
 * Environment variable `VERCEL_ENV` provided by Vercel.
 * `production`, `preview`, or `development`.
 * @see {@link https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_ENV}
 *
 * Whether this is some sort of preview environment.
 */
const isPreview =
  isPR ||
  (process.env.CONTEXT && process.env.CONTEXT !== 'production') ||
  process.env.VERCEL_ENV === 'preview' ||
  process.env.VERCEL_ENV === 'development'
export const isProduction =
  process.env.CONTEXT === 'production' || process.env.VERCEL_ENV === 'production'

/**
 * Environment variable `URL` provided by Netlify.
 * This is always the current deploy URL, regardless of env.
 * @see {@link https://docs.netlify.com/build/functions/environment-variables/#functions}
 *
 * Environment variable `VERCEL_URL` provided by Vercel.
 * This is always the current deploy URL, regardless of env.
 * NOTE: Not a valid URL, as the protocol is omitted.
 * @see {@link https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_URL}
 *
 * Preview URL for the current deployment, only available in preview environments.
 */
export const getPreviewUrl = () =>
  isPreview
    ? process.env.URL
      ? process.env.URL
      : process.env.NUXT_ENV_VERCEL_URL
        ? `https://${process.env.NUXT_ENV_VERCEL_URL}`
        : undefined
    : undefined

/**
 * Environment variable `URL` provided by Netlify.
 * This is always the current deploy URL, regardless of env.
 * @see {@link https://docs.netlify.com/build/functions/environment-variables/#functions}
 *
 * Environment variable `VERCEL_PROJECT_PRODUCTION_URL` provided by Vercel.
 * NOTE: Not a valid URL, as the protocol is omitted.
 * @see {@link https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_PROJECT_PRODUCTION_URL}
 *
 * Production URL for the current deployment, only available in production environments.
 */
export const getProductionUrl = () =>
  isProduction
    ? process.env.URL
      ? process.env.URL
      : process.env.NUXT_ENV_VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.NUXT_ENV_VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined
    : undefined

const git = Git()
async function getGitInfo() {
  let branch
  try {
    branch = gitBranch || (await git.revparse(['--abbrev-ref', 'HEAD']))
  } catch {
    branch = 'unknown'
  }

  let commit
  try {
    // Netlify: COMMIT_REF, Vercel: VERCEL_GIT_COMMIT_SHA
    commit =
      process.env.COMMIT_REF || process.env.VERCEL_GIT_COMMIT_SHA || (await git.revparse(['HEAD']))
  } catch {
    commit = 'unknown'
  }

  let shortCommit
  try {
    if (commit && commit !== 'unknown') {
      shortCommit = commit.slice(0, 7)
    } else {
      shortCommit = await git.revparse(['--short=7', 'HEAD'])
    }
  } catch {
    shortCommit = 'unknown'
  }

  return { branch, commit, shortCommit }
}

export async function getFileLastUpdated(path: string) {
  try {
    // Get ISO date of last commit for file
    const date = await git.log(['-1', '--format=%cI', '--', path])
    return date.latest?.date || new Date().toISOString()
  } catch {
    return new Date().toISOString()
  }
}

/**
 * Resolves the **next** version by analysing conventional commits since the
 * last reachable `v*` tag.  Delegates to {@link getNextVersion} which is also
 * used by the `release-tag` and `release-pr` GitHub Actions workflows so the
 * version shown in the UI matches the tag that will be created *after* deploy.
 *
 * Falls back to `package.json` when git is unavailable (e.g. shallow clone).
 */
export async function getVersion() {
  try {
    const { next } = await getNextVersion()
    return next
  } catch {
    return packageVersion
  }
}

export async function getEnv(isDevelopment: boolean) {
  const [{ commit, shortCommit, branch }, version] = await Promise.all([getGitInfo(), getVersion()])
  const env = isDevelopment ? 'dev' : isCanary ? 'canary' : isPreview ? 'preview' : 'release'
  const previewUrl = getPreviewUrl()
  const productionUrl = getProductionUrl()
  return {
    version,
    commit,
    shortCommit,
    branch,
    env,
    previewUrl,
    productionUrl,
    prNumber,
  } as const
}
