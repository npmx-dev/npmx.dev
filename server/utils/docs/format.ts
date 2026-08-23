/**
 * Signature Formatting
 *
 * Functions for formatting TypeScript signatures, parameters, and types.
 *
 * @module server/utils/docs/format
 */

import type { DenoDocNode, FunctionParam, TsType } from '#shared/types/deno-doc'
import { cleanSymbolName, stripAnsi } from './text'

/**
 * Generate a TypeScript signature string for a node.
 */
export function getNodeSignature(node: DenoDocNode): string | null {
  const name = cleanSymbolName(node.name)

  switch (node.kind) {
    case 'function': {
      const typeParams = node.functionDef?.typeParams?.map(t => t.name).join(', ')
      const typeParamsStr = typeParams ? `<${typeParams}>` : ''
      const params = formatParams(node.functionDef?.params)
      const ret = formatType(node.functionDef?.returnType) || 'void'
      const asyncStr = node.functionDef?.isAsync ? 'async ' : ''
      return `${asyncStr}function ${name}${typeParamsStr}(${params}): ${ret}`
    }
    case 'class': {
      const ext = node.classDef?.extends ? ` extends ${node.classDef.extends}` : ''
      const impl = node.classDef?.implements?.map(t => formatType(t)).join(', ')
      const implStr = impl ? ` implements ${impl}` : ''
      const abstractStr = node.classDef?.isAbstract ? 'abstract ' : ''
      return `${abstractStr}class ${name}${ext}${implStr}`
    }
    case 'interface': {
      const typeParams = node.interfaceDef?.typeParams?.map(t => t.name).join(', ')
      const typeParamsStr = typeParams ? `<${typeParams}>` : ''
      const ext = node.interfaceDef?.extends?.map(t => formatType(t)).join(', ')
      const extStr = ext ? ` extends ${ext}` : ''
      return `interface ${name}${typeParamsStr}${extStr}`
    }
    case 'typeAlias': {
      const typeParams = node.typeAliasDef?.typeParams?.map(t => t.name).join(', ')
      const typeParamsStr = typeParams ? `<${typeParams}>` : ''
      const type = formatType(node.typeAliasDef?.tsType) || 'unknown'
      return `type ${name}${typeParamsStr} = ${type}`
    }
    case 'variable': {
      const keyword = node.variableDef?.kind === 'const' ? 'const' : 'let'
      const type = formatType(node.variableDef?.tsType) || 'unknown'
      return `${keyword} ${name}: ${type}`
    }
    case 'enum': {
      return `enum ${name}`
    }
    default:
      return null
  }
}

/**
 * Format a function parameter.
 */
export function formatParam(param: FunctionParam, index = 0): string {
  const name = param.name || `arg_${index}`
  const optional = param.optional ? '?' : ''
  const type = formatType(param.tsType)
  return type ? `${name}${optional}: ${type}` : `${name}${optional}`
}

/**
 * Format a function parameter list.
 */
export function formatParams(params?: FunctionParam[]): string {
  return params?.map((param, index) => formatParam(param, index)).join(', ') || ''
}

/**
 * Format a TypeScript type.
 */
export function formatType(type?: TsType): string {
  if (!type) return ''

  const formatter = TYPE_FORMATTERS[type.kind]
  const formatted = formatter?.(type)

  if (formatted) return formatted
  return type.repr ? stripAnsi(type.repr) : 'unknown'
}

const TYPE_FORMATTERS: Partial<Record<TsType['kind'], (type: TsType) => string>> = {
  keyword: type => type.keyword || '',
  literal: type => {
    if (!type.literal) return ''
    if (type.literal.kind === 'string') return `"${type.literal.string}"`
    if (type.literal.kind === 'number') return String(type.literal.number)
    if (type.literal.kind === 'boolean') return String(type.literal.boolean)
    if (type.literal.kind === 'bigInt') return `${type.literal.string}n`
    if (type.literal.kind === 'template')
      return `\`${(type.literal.tsTypes ?? []).map(t => formatType(t)).join('')}\``
    return ''
  },
  typeRef: type => {
    if (!type.typeRef) return ''
    const params = type.typeRef.typeParams?.map(t => formatType(t)).join(', ')
    return params ? `${type.typeRef.typeName}<${params}>` : type.typeRef.typeName
  },
  array: type => {
    if (!type.array) return ''
    const element = formatType(type.array)
    return ['union', 'intersection', 'conditional', 'fnOrConstructor', 'typeOperator'].includes(
      type.array.kind,
    )
      ? `(${element})[]`
      : `${element}[]`
  },
  union: type => (type.union ? type.union.map(t => formatType(t)).join(' | ') : ''),
  intersection: type =>
    type.intersection
      ? type.intersection
          .map(t => {
            const formatted = formatType(t)
            return ['union', 'conditional', 'fnOrConstructor'].includes(t.kind)
              ? `(${formatted})`
              : formatted
          })
          .join(' & ')
      : '',
  tuple: type => (type.tuple ? `[${type.tuple.map(t => formatType(t)).join(', ')}]` : ''),
  parenthesized: type => (type.parenthesized ? `(${formatType(type.parenthesized)})` : ''),
  rest: type => (type.rest ? `...${formatType(type.rest)}` : ''),
  optional: type => (type.optional ? `${formatType(type.optional)}?` : ''),
  typeQuery: type => (type.typeQuery ? `typeof ${type.typeQuery}` : ''),
  conditional: type => {
    if (!type.conditionalType) return ''
    const conditional = type.conditionalType
    return `(${formatType(conditional.checkType)} extends ${formatType(conditional.extendsType)} ? ${formatType(conditional.trueType)} : ${formatType(conditional.falseType)})`
  },
  mapped: type => {
    if (!type.mappedType) return ''
    const mapped = type.mappedType
    const readonlyPrefix =
      mapped.readonly === '-'
        ? '-readonly '
        : mapped.readonly === '+'
          ? '+readonly '
          : mapped.readonly
            ? 'readonly '
            : ''
    const optionalSuffix =
      mapped.optional === '-' ? '-?' : mapped.optional === '+' ? '+?' : mapped.optional ? '?' : ''
    const asClause = mapped.nameType ? ` as ${formatType(mapped.nameType)}` : ''
    const constraint = mapped.typeParam.constraint
      ? formatType(mapped.typeParam.constraint)
      : 'unknown'
    const value = mapped.tsType ? formatType(mapped.tsType) || 'unknown' : 'unknown'
    return `{ ${readonlyPrefix}[${mapped.typeParam.name} in ${constraint}${asClause}]${optionalSuffix}: ${value} }`
  },
  importType: type => {
    if (!type.importType) return ''
    const qualifier = type.importType.qualifier ? `.${type.importType.qualifier}` : ''
    const params = type.importType.typeParams?.map(t => formatType(t))
    const paramsStr = params?.length ? `<${params.join(', ')}>` : ''
    return `import("${type.importType.specifier}")${qualifier}${paramsStr}`
  },
  infer: type => (type.infer ? `infer ${type.infer.typeParam.name}` : ''),
  typePredicate: type => {
    if (!type.typePredicate) return ''
    const predicate = type.typePredicate
    const target = predicate.param.type === 'this' ? 'this' : (predicate.param.name ?? '')
    const rendered = predicate.type ? `${target} is ${formatType(predicate.type)}` : target
    return predicate.asserts ? `asserts ${rendered}` : rendered
  },
  this: () => 'this',
  indexedAccess: type => {
    if (!type.indexedAccess) return ''
    return `${formatType(type.indexedAccess.objType)}[${formatType(type.indexedAccess.indexType)}]`
  },
  typeOperator: type => {
    if (!type.typeOperator) return ''
    return `${type.typeOperator.operator} ${formatType(type.typeOperator.tsType)}`
  },
  fnOrConstructor: type =>
    type.fnOrConstructor ? formatFnOrConstructorType(type.fnOrConstructor) : '',
  typeLiteral: type => (type.typeLiteral ? formatTypeLiteralType(type.typeLiteral) : ''),
}

function formatFnOrConstructorType(fn: NonNullable<TsType['fnOrConstructor']>): string {
  const typeParams = fn.typeParams?.map(t => t.name).join(', ')
  const typeParamsStr = typeParams ? `<${typeParams}>` : ''
  const params = formatParams(fn.params)
  const ret = formatType(fn.tsType) || 'void'
  return `${typeParamsStr}(${params}) => ${ret}`
}

function formatTypeLiteralType(lit: NonNullable<TsType['typeLiteral']>): string {
  const parts: string[] = []
  for (const prop of lit.properties) {
    const opt = prop.optional ? '?' : ''
    const ro = prop.readonly ? 'readonly ' : ''
    parts.push(`${ro}${prop.name}${opt}: ${formatType(prop.tsType) || 'unknown'}`)
  }
  for (const method of lit.methods) {
    const params = formatParams(method.params)
    const ret = formatType(method.returnType) || 'void'
    parts.push(`${method.name}(${params}): ${ret}`)
  }
  return `{ ${parts.join('; ')} }`
}
