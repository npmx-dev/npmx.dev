/* oxlint-disable no-console */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { colors } from './utils/colors.ts'

const I18N_DIRECTORY = fileURLToPath(new URL('../i18n', import.meta.url))
const LOCALES_DIRECTORY = join(I18N_DIRECTORY, 'locales')
const REFERENCE_FILE_NAME = 'en.json'
const SCHEMA_FILE_NAME = 'schema.json'

type Json = Record<string, unknown>
type LocaleJson = Json & { $schema: string }

interface JsonSchema {
  $schema?: string
  title?: string
  description?: string
  type: string
  properties?: Record<string, JsonSchema>
  additionalProperties?: boolean
}

const generateSubSchema = (obj: Json): JsonSchema => {
  const properties: Record<string, JsonSchema> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      properties[key] = generateSubSchema(value as Json)
    } else {
      properties[key] = { type: 'string' }
    }
  }

  return {
    type: 'object',
    properties,
    additionalProperties: false,
  }
}

const generateSchema = (obj: LocaleJson): JsonSchema => {
  const { $schema: _, ...rest } = obj // Exclude $schema from schema generation
  const baseSchema = generateSubSchema(rest)
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'npmx i18n locale file',
    description:
      'Schema for npmx i18n translation files. Generated from en.json — do not edit manually.',
    ...baseSchema,
    // Allow $schema property at root level
    properties: {
      ...baseSchema.properties,
      $schema: { type: 'string' },
    },
  }
}

/*
 * Generates a JSON Schema from the reference locale file (en.json) and writes it to
 * i18n/schema.json. All locale files include a $schema property that points to this file.
 *
 * This allows IDEs to provide validation, autocompletion, and other hints in translation files.
 */
const main = async (): Promise<void> => {
  const referenceFilePath = join(LOCALES_DIRECTORY, REFERENCE_FILE_NAME)
  const referenceContent = JSON.parse(await readFile(referenceFilePath, 'utf-8')) as LocaleJson

  const schema = generateSchema(referenceContent)

  const schemaFilePath = join(I18N_DIRECTORY, SCHEMA_FILE_NAME)
  await writeFile(schemaFilePath, JSON.stringify(schema, null, 2) + '\n', 'utf-8')

  console.log(colors.green(`✅ Generated schema at ${schemaFilePath}`))
}

await main()
