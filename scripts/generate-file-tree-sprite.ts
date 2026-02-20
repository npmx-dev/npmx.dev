import type { IconifyJSON } from '@iconify-json/lucide'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  ADDITIONAL_ICONS,
  EXTENSION_ICONS,
  FILENAME_ICONS,
  COMPOUND_EXTENSIONS,
  DEFAULT_ICON,
} from '../app/utils/file-icons.ts'

const rootDir = process.cwd()
const outputDevPath = path.join(rootDir, 'public', 'file-tree-sprite.svg')
const outputStagePath = path.join(rootDir, 'public-dev', 'file-tree-sprite.svg')
const outputProdPath = path.join(rootDir, 'public-prod', 'file-tree-sprite.svg')

const COLLECTION_NAMES = ['lucide', 'simple-icons', 'svg-spinners', 'vscode-icons']

const COLLECTION_REGEXP = new RegExp(`^(${COLLECTION_NAMES.join('|')})-(.+)$`)

async function loadCollections() {
  const collections: { [key: string]: IconifyJSON } = {}
  for (const name of COLLECTION_NAMES) {
    const filePathUrl = import.meta.resolve(`@iconify-json/${name}/icons.json`)
    const filePath = fileURLToPath(filePathUrl)
    const raw = await fs.readFile(filePath, 'utf8')
    collections[name] = JSON.parse(raw)
  }
  return collections
}

function groupByCollection(iconNames: string[]) {
  const grouped: { [key: string]: string[] } = {}
  for (const name of iconNames) {
    const [, group, iconName] = name.match(COLLECTION_REGEXP) || []
    if (group && iconName) {
      grouped[group] ||= []
      grouped[group].push(iconName)
    }
  }
  return grouped
}

function buildSprite(
  grouped: { [key: string]: string[] },
  collections: { [key: string]: IconifyJSON },
) {
  let symbols = ''
  Object.entries(grouped).forEach(([prefix, iconNames]) => {
    const collection = collections[prefix]

    if (!collection?.icons) return

    const defaultWidth = collection.width ?? 16
    const defaultHeight = collection.height ?? 16

    iconNames.forEach(name => {
      const icon = collection.icons[name]

      if (!icon?.body) return

      const width = icon.width ?? defaultWidth
      const height = icon.height ?? defaultHeight
      const viewBox = `0 0 ${width} ${height}`
      const id = `${collection.prefix}-${name}`
      symbols += `<symbol id="${id}" viewBox="${viewBox}">${icon.body}</symbol>`
    })
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${symbols}</svg>\n`
}

async function main() {
  const collections = await loadCollections()
  const iconNames = [
    ...Object.values(EXTENSION_ICONS),
    ...Object.values(FILENAME_ICONS),
    ...Object.values(COMPOUND_EXTENSIONS),
    ...Object.values(ADDITIONAL_ICONS),
    DEFAULT_ICON,
  ]
  const grouped = groupByCollection(iconNames)
  const sprite = buildSprite(grouped, collections)
  await Promise.all([
    fs.mkdir(path.dirname(outputDevPath), { recursive: true }),
    fs.mkdir(path.dirname(outputStagePath), { recursive: true }),
    fs.mkdir(path.dirname(outputProdPath), { recursive: true }),
  ])
  await Promise.all([
    fs.writeFile(outputDevPath, sprite, 'utf8'),
    fs.writeFile(outputStagePath, sprite, 'utf8'),
    fs.writeFile(outputProdPath, sprite, 'utf8'),
  ])
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
