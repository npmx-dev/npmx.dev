import type { NitroConfig } from 'nitropack'
import { defineNuxtModule } from 'nuxt/kit'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { isPreview, isProduction } from '../config/env'
import { ELEMENT_NODE, parse, walk } from 'ultrahtml'
// import type { Manifest } from "@voidzero-dev/vite-plus-core";

// TODO: use the context and maybe we should move the module to a folder
// interface RouteRulesContext {
//   globalFonts: string[]
//   manifest: Manifest
// }

// Cache for global fonts extracted from entry CSS
let globalFonts: string[] = []

async function extractFontsFromCss(cssPath: string): Promise<string[]> {
  try {
    const content = await readFile(cssPath, 'utf8')
    const fontUrls = new Set<string>()
    // original with backtracking => oxlint complains
    // const regex = /url\(\s*(?:["']?)([^"')]+?\.woff2)(?:["']?)\s*\)/g

    // Regex to capture woff2 urls: url(../_fonts/...) or url("../_fonts/...")
    // Captures the content inside url(...) stripping quotes if present
    // Optimized to avoid ReDoS (super-linear backtracking)
    const regex = /url\(\s*['"]?([^\s'")\\]+\.woff2)(?:'|")?\s*\)/g

    let match
    while ((match = regex.exec(content)) !== null) {
      const url = match[1]
      if (url) {
        fontUrls.add(url)
      }
    }
    return Array.from(fontUrls)
  } catch (e) {
    console.error(`Failed to extract fonts from ${cssPath}:`, e)
    return []
  }
}

async function collectLinkHeader(path: string): Promise<string | undefined> {
  try {
    const html = await readFile(path, 'utf8')
    const ast = parse(html)
    const links: string[] = []

    // Add global fonts (preload)
    for (const font of globalFonts) {
      let fontPath = font
      if (font.startsWith('../')) {
        fontPath = font.substring(2) // Remove ..
      }
      if (!fontPath.startsWith('/')) {
        fontPath = '/' + fontPath
      }
      links.push(`<${fontPath}>; rel=preload; as=font; crossorigin`)
    }

    await walk(ast, node => {
      if (node.type === ELEMENT_NODE) {
        if (node.name === 'script') {
          const type = node.attributes.type
          const src = node.attributes.src
          if (type === 'module' && src && !src.startsWith('http')) {
            const cors =
              node.attributes.crossorigin === '' || node.attributes.crossorigin === 'true'
                ? '; crossorigin'
                : ''
            links.push(`<${src}>; rel=modulepreload; as=script${cors}`)
          }
        } else if (node.name === 'link') {
          const rel = node.attributes.rel
          const href = node.attributes.href
          if (rel === 'modulepreload' && href && !href.startsWith('http')) {
            const cors =
              node.attributes.crossorigin === '' || node.attributes.crossorigin === 'true'
                ? '; crossorigin'
                : ''
            links.push(`<${href}>; rel=modulepreload; as=script${cors}`)
          } else if (rel === 'stylesheet' && href && !href.startsWith('http')) {
            // Preload CSS
            const cors =
              node.attributes.crossorigin === '' || node.attributes.crossorigin === 'true'
                ? '; crossorigin'
                : ''
            links.push(`<${href}>; rel=preload; as=style ${cors}`)
          }
        }
      }
    })

    // console.log(path, links)

    return links.length > 0 ? links.join(', ') : undefined
  } catch (e) {
    console.error(`error collecting link header for ${path}`, e)
    // Ignore file not found (route might not be prerendered yet or is dynamic)
    return undefined
  }
}

async function collectLinkHeaders(outDir: string, options: NitroConfig): Promise<NitroConfig> {
  const routeRules = Object.assign({}, options.routeRules)

  for (const route of Object.keys(routeRules)) {
    const rule = routeRules[route]
    if (
      !rule?.prerender ||
      route.includes('*') ||
      route.endsWith('.html') ||
      route.endsWith('.json')
    ) {
      continue
    }

    let htmlPath = resolve(outDir, route === '/' ? 'index.html' : `${route.slice(1)}/index.html`)

    const linkHeader = await collectLinkHeader(htmlPath)
    if (linkHeader) {
      routeRules[route]!.headers ??= {}
      routeRules[route]!.headers.Link = linkHeader
    }
  }

  return { routeRules }
}

export default defineNuxtModule({
  meta: {
    name: 'npmx:route-rules',
  },
  setup(_options, nuxt) {
    // TODO: use this for local test with http/1.1 and node preset
    /*
    if (nuxt.options.dev || process.env.TEST /!* || !(isPreview || isProduction)*!/) {
      return
    }
*/
    if (nuxt.options.dev || process.env.TEST || !(isPreview || isProduction)) {
      return
    }

    let outDir = '../.output/public'

    nuxt.hook('nitro:init', nitro => {
      const nitroConfig = nitro.options
      const publicDir = nitroConfig.output?.publicDir ?? nuxt.options.nitro?.output?.publicDir
      outDir = publicDir ? resolve(publicDir) : resolve(nuxt.options.buildDir, '../.output/public')
      nitro.hooks.hook('prerender:done', async () => {
        const updates = await collectLinkHeaders(outDir, nitro.options)
        await nitro.updateConfig(updates)
        // console.log(updates)
      })
    })

    // Hook into build:manifest to find the entry CSS and extract fonts
    nuxt.hook('build:manifest', async manifest => {
      // console.log(manifest)
      const entry = Object.values(manifest).find(r => r.isEntry)
      if (entry && entry.css) {
        for (const cssFile of entry.css) {
          // Try to resolve CSS path. It might be in _nuxt/ or root of dist/client
          // Based on log: node_modules/.cache/nuxt/.nuxt/dist/client/_nuxt/pages...css
          // nuxt.options.buildDir points to .nuxt
          let cssPath = resolve('node_modules/.cache/nuxt/.nuxt/dist/client/_nuxt', cssFile)

          // If cssFile doesn't start with _nuxt but is inside it, adjust
          // But usually manifest paths are relative to public path or build output

          // Fallback/Check: if file doesn't exist, try adding _nuxt if missing
          // But let's trust resolve first.

          const fonts = await extractFontsFromCss(cssPath)
          globalFonts.push(...fonts)
        }
      }

      // console.log(globalFonts)
    })
  },
})
