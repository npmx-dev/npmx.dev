import Git from 'simple-git'
import * as process from 'node:process'

export { version } from '../package.json'

/**
 * Environment variable `PULL_REQUEST` provided by Netlify.
 * @see {@link https://docs.netlify.com/build/configure-builds/environment-variables/#git-metadata}
 *
 * Environment variable `VERCEL_GIT_PULL_REQUEST_ID` provided by Vercel.
 * @see {@link https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_GIT_PULL_REQUEST_ID}
 *
 * Whether triggered by a GitHub PR
 */
export const isPR = process.env.PULL_REQUEST === 'true' || !!process.env.VERCEL_GIT_PULL_REQUEST_ID

/**
 * Environment variable `BRANCH` provided by Netlify.
 * @see {@link https://docs.netlify.com/build/configure-builds/environment-variables/#git-metadata}
 *
 * Environment variable `VERCEL_GIT_COMMIT_REF` provided by Vercel.
 * @see {@link https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_GIT_COMMIT_REF}
 *
 * Git branch
 */
export const gitBranch = process.env.BRANCH || process.env.VERCEL_GIT_COMMIT_REF

/**
 * Environment variable `CONTEXT` provided by Netlify.
 * @see {@link https://docs.netlify.com/build/configure-builds/environment-variables/#build-metadata}
 *
 * Environment variable `VERCEL_ENV` provided by Vercel.
 * @see {@link https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_ENV}
 *
 * Whether triggered by PR, `deploy-preview` or `dev`.
 */
export const isPreview =
  isPR ||
  process.env.CONTEXT === 'deploy-preview' ||
  process.env.CONTEXT === 'dev' ||
  process.env.VERCEL_ENV === 'preview' ||
  process.env.VERCEL_ENV === 'development'

const git = Git()
export async function getGitInfo() {
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

export async function getEnv(isDevelopment: boolean) {
  const { commit, shortCommit, branch } = await getGitInfo()
  const env = isDevelopment
    ? 'dev'
    : isPreview
      ? 'preview'
      : branch === 'main'
        ? 'canary'
        : 'release'
  return { commit, shortCommit, branch, env } as const
}
