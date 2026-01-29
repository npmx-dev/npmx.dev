import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import githubDark from '@shikijs/themes/github-dark'
import githubLight from '@shikijs/themes/github-light'
import javascript from '@shikijs/langs/javascript'
import typescript from '@shikijs/langs/typescript'
import json from '@shikijs/langs/json'

let highlighterPromise: Promise<HighlighterCore> | null = null

/**
 * Lightweight client-side Shiki highlighter (JS/TS/JSON only).
 */
export function getClientHighlighter(): Promise<HighlighterCore> {
  if (highlighterPromise) return highlighterPromise

  highlighterPromise = createHighlighterCore({
    themes: [githubDark, githubLight],
    langs: [javascript, typescript, json],
    engine: createJavaScriptRegexEngine(),
  })

  return highlighterPromise
}
