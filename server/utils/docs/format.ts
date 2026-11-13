/**
 * Signature Formatting
 *
 * Functions for formatting TypeScript signatures, parameters, and types.
 *
 * @module server/utils/docs/format
 */

import type { LiteralDef, ParamDef, TruePlusMinus, TsTypeDef, TsTypeParamDef } from '@deno/doc'
import type { DocNode } from './types'
import { cleanSymbolName, stripAnsi } from './text'

/**
 * Generate a TypeScript signature string for a node.
 */
export function getNodeSignature(node: DocNode): string | null {
  const name = cleanSymbolName(node.name)

  switch (node.kind) {
    case 'function': {
      const { typeParams, params, returnType, isAsync } = node.def
      const asyncStr = isAsync ? 'async ' : ''
      return `${asyncStr}function ${name}${formatTypeParams(typeParams)}(${formatParams(params)}): ${formatType(returnType) || 'void'}`
    }
    case 'class': {
      const { extends: superClass, superTypeParams, typeParams, implements: interfaces } = node.def
      const superArgs = superTypeParams?.map(t => formatType(t)).join(', ')
      const ext = superClass ? ` extends ${superClass}${superArgs ? `<${superArgs}>` : ''}` : ''
      const impl = interfaces?.map(t => formatType(t)).join(', ')
      const implStr = impl ? ` implements ${impl}` : ''
      const abstractStr = node.def.isAbstract ? 'abstract ' : ''
      return `${abstractStr}class ${name}${formatTypeParams(typeParams)}${ext}${implStr}`
    }
    case 'interface': {
      const ext = node.def.extends?.map(t => formatType(t)).join(', ')
      const extStr = ext ? ` extends ${ext}` : ''
      return `interface ${name}${formatTypeParams(node.def.typeParams)}${extStr}`
    }
    case 'typeAlias': {
      const type = formatType(node.def.tsType) || 'unknown'
      return `type ${name}${formatTypeParams(node.def.typeParams)} = ${type}`
    }
    case 'variable': {
      const keyword = node.def.kind === 'const' ? 'const' : 'let'
      return `${keyword} ${name}: ${formatType(node.def.tsType) || 'unknown'}`
    }
    case 'enum':
      return `enum ${name}`
    default:
      return null
  }
}

function formatTypeParam(param: TsTypeParamDef): string {
  const constraint = param.constraint ? ` extends ${formatType(param.constraint)}` : ''
  const fallback = param.default ? ` = ${formatType(param.default)}` : ''
  return `${param.name}${constraint}${fallback}`
}

function formatTypeParams(typeParams?: TsTypeParamDef[]): string {
  return typeParams?.length ? `<${typeParams.map(formatTypeParam).join(', ')}>` : ''
}

function getParamName(param: ParamDef): string | undefined {
  switch (param.kind) {
    case 'identifier':
      return param.name
    case 'assign':
      return getParamName(param.left)
    case 'rest':
      return getParamName(param.arg)
    case 'array':
    case 'object':
      return undefined
  }
}

function isOptionalParam(param: ParamDef): boolean {
  switch (param.kind) {
    case 'assign':
      return true
    case 'identifier':
    case 'array':
    case 'object':
      return param.optional
    case 'rest':
      return false
  }
}

function getParamType(param: ParamDef): TsTypeDef | undefined {
  // A parameter with a default value keeps its type on the wrapped parameter
  return param.kind === 'assign' ? getParamType(param.left) : param.tsType
}

/**
 * Format a function parameter.
 */
function formatParam(param: ParamDef, index = 0): string {
  const name = `${param.kind === 'rest' ? '...' : ''}${getParamName(param) || `arg_${index}`}`
  const optional = isOptionalParam(param) ? '?' : ''
  const type = formatType(getParamType(param))
  return type ? `${name}${optional}: ${type}` : `${name}${optional}`
}

/**
 * Format a function parameter list.
 */
export function formatParams(params?: ParamDef[]): string {
  return params?.map((param, index) => formatParam(param, index)).join(', ') || ''
}

/**
 * Format a TypeScript type.
 */
export function formatType(type?: TsTypeDef): string {
  if (!type) return ''

  const formatted = formatKnownType(type)
  if (formatted) return formatted

  return type.repr ? stripAnsi(type.repr) : 'unknown'
}

function formatKnownType(type: TsTypeDef): string {
  switch (type.kind) {
    case 'keyword':
      return type.value
    case 'literal':
      return formatLiteral(type.value)
    case 'typeRef': {
      const params = type.value.typeParams?.map(t => formatType(t)).join(', ')
      return params ? `${type.value.typeName}<${params}>` : type.value.typeName
    }
    case 'array': {
      const element = formatType(type.value)
      return type.value.kind === 'union' ? `(${element})[]` : `${element}[]`
    }
    case 'union':
      return type.value.map(t => formatType(t)).join(' | ')
    case 'intersection':
      return type.value.map(t => formatType(t)).join(' & ')
    case 'tuple':
      return `[${type.value.map(t => formatType(t)).join(', ')}]`
    case 'parenthesized':
      return `(${formatType(type.value)})`
    case 'rest':
      return `...${formatType(type.value)}`
    case 'optional':
      return `${formatType(type.value)}?`
    case 'this':
      return 'this'
    case 'indexedAccess':
      return `${formatType(type.value.objType)}[${formatType(type.value.indexType)}]`
    case 'typeOperator':
      return `${type.value.operator} ${formatType(type.value.tsType)}`
    case 'fnOrConstructor': {
      const { constructor: isConstructor, typeParams, params, tsType } = type.value
      const newStr = isConstructor ? 'new ' : ''
      return `${newStr}${formatTypeParams(typeParams)}(${formatParams(params)}) => ${formatType(tsType) || 'void'}`
    }
    case 'typeQuery':
      return `typeof ${type.value}`
    case 'typeLiteral':
      return formatTypeLiteral(type.value)
    case 'conditional': {
      const { checkType, extendsType, trueType, falseType } = type.value
      return `${formatType(checkType)} extends ${formatType(extendsType)} ? ${formatType(trueType)} : ${formatType(falseType)}`
    }
    case 'infer':
      return `infer ${formatTypeParam(type.value.typeParam)}`
    case 'mapped':
      return formatMappedType(type.value)
    default:
      return ''
  }
}

function formatModifier(modifier: TruePlusMinus | undefined, keyword: string): string {
  if (modifier === undefined) return ''
  if (modifier === '+' || modifier === '-') return `${modifier}${keyword}`
  return keyword
}

function formatMappedType(mapped: Extract<TsTypeDef, { kind: 'mapped' }>['value']): string {
  const { readonly, typeParam, nameType, optional, tsType } = mapped
  const readonlyStr = formatModifier(readonly, 'readonly')
  const constraint = formatType(typeParam.constraint) || 'unknown'
  const asStr = nameType ? ` as ${formatType(nameType)}` : ''
  const optionalStr = formatModifier(optional, '?')
  return `{ ${readonlyStr ? `${readonlyStr} ` : ''}[${typeParam.name} in ${constraint}${asStr}]${optionalStr}: ${formatType(tsType) || 'unknown'} }`
}

/**
 * Text chunks are emitted as string literals and interpolations as any other type.
 * An interpolated string literal (`${'a'}`) can't be told apart from a chunk, so it renders inline.
 */
function formatTemplateLiteral(tsTypes: TsTypeDef[]): string {
  const body = tsTypes
    .map(t =>
      t.kind === 'literal' && t.value.kind === 'string'
        ? t.value.string.replaceAll('`', '\\`')
        : `\${${formatType(t)}}`,
    )
    .join('')
  return `\`${body}\``
}

function formatLiteral(literal: LiteralDef): string {
  switch (literal.kind) {
    case 'string':
      return JSON.stringify(literal.string)
    case 'number':
      return String(literal.number)
    case 'boolean':
      return String(literal.boolean)
    case 'bigInt':
      return `${literal.string}n`
    case 'template':
      return formatTemplateLiteral(literal.tsTypes)
    default:
      return ''
  }
}

interface TypeLiteralConstructor {
  params: ParamDef[]
  returnType?: TsTypeDef
}

function getTypeLiteralConstructors(
  literal: Extract<TsTypeDef, { kind: 'typeLiteral' }>['value'],
): TypeLiteralConstructor[] {
  return (literal.constructors ?? []).filter(
    (signature): signature is TypeLiteralConstructor =>
      typeof signature === 'object' &&
      signature !== null &&
      'params' in signature &&
      Array.isArray(signature.params),
  )
}

function formatTypeLiteral(literal: Extract<TsTypeDef, { kind: 'typeLiteral' }>['value']): string {
  const parts: string[] = []
  for (const signature of literal.indexSignatures ?? []) {
    const ro = signature.readonly ? 'readonly ' : ''
    parts.push(
      `${ro}[${formatParams(signature.params)}]: ${formatType(signature.tsType) || 'unknown'}`,
    )
  }
  for (const signature of literal.callSignatures ?? []) {
    const ret = formatType(signature.tsType) || 'void'
    parts.push(
      `${formatTypeParams(signature.typeParams)}(${formatParams(signature.params)}): ${ret}`,
    )
  }
  // The published types only declare `constructors` as `unknown[]`
  for (const signature of getTypeLiteralConstructors(literal)) {
    const ret = formatType(signature.returnType) || 'unknown'
    parts.push(`new (${formatParams(signature.params)}): ${ret}`)
  }
  for (const prop of literal.properties ?? []) {
    const opt = prop.optional ? '?' : ''
    const ro = prop.readonly ? 'readonly ' : ''
    parts.push(`${ro}${prop.name}${opt}: ${formatType(prop.tsType) || 'unknown'}`)
  }
  for (const method of literal.methods ?? []) {
    const params = formatParams(method.params)
    const ret = formatType(method.returnType) || 'void'
    parts.push(`${method.name}(${params}): ${ret}`)
  }
  return parts.length > 0 ? `{ ${parts.join('; ')} }` : '{}'
}
