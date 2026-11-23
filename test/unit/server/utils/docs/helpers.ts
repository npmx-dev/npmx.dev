import type {
  ClassConstructorDef,
  ClassMethodDef,
  ClassPropertyDef,
  EnumMemberDef,
  FunctionDef,
  InterfaceMethodDef,
  InterfacePropertyDef,
  JsDoc,
  ParamDef,
  TsTypeDef,
} from '@deno/doc'
import type { DocNode } from '#server/utils/docs/types'

const location = { filename: 'file:///test.d.ts', line: 1, col: 0 }
const base = { location, declarationKind: 'export' } as const

export function requireItem<T>(items: readonly T[] | undefined, index: number): T {
  const item = items?.[index]
  if (item === undefined) throw new Error(`Expected an item at index ${index}`)
  return item
}

export function requireNamed<T extends { name: string }>(
  items: readonly T[] | undefined,
  name: string,
): T {
  const item = items?.find(candidate => candidate.name === name)
  if (item === undefined) throw new Error(`Expected an item named ${name}`)
  return item
}

export function keywordType(value: string): TsTypeDef {
  return { kind: 'keyword', value, repr: value }
}

export function typeRefType(typeName: string): TsTypeDef {
  return { kind: 'typeRef', value: { typeName }, repr: typeName }
}

export function param(name: string, tsType?: TsTypeDef): ParamDef {
  return { kind: 'identifier', name, optional: false, tsType }
}

export function functionNode(name: string, def: Partial<FunctionDef> = {}, jsDoc?: JsDoc): DocNode {
  return {
    ...base,
    name,
    kind: 'function',
    jsDoc,
    def: { params: [], returnType: keywordType('void'), ...def },
  }
}

export function classConstructor(params: ParamDef[] = []): ClassConstructorDef {
  return { name: 'constructor', params, location }
}

export function classProperty(
  name: string,
  extra: Partial<ClassPropertyDef> = {},
): ClassPropertyDef {
  return { name, location, ...extra }
}

type ClassMethodInput = {
  name: string
  kind?: ClassMethodDef['kind']
  isStatic?: true
  jsDoc?: JsDoc
  functionDef?: Partial<FunctionDef>
}

export function classMethod(input: ClassMethodInput): ClassMethodDef {
  const { functionDef, kind = 'method', ...rest } = input
  const functionDefValue: FunctionDef = { params: [], ...functionDef }
  // Only the shape the WASM build really emits (`functionDef`, not the typed `def`), so tests
  // fail if the code stops handling it.
  return { ...rest, kind, location, functionDef: functionDefValue } as unknown as ClassMethodDef
}

export function classNode(
  name: string,
  def: {
    constructors?: ClassConstructorDef[]
    properties?: ClassPropertyDef[]
    methods?: ClassMethodDef[]
  } = {},
): DocNode {
  return { ...base, name, kind: 'class', def }
}

export function interfaceProperty(
  name: string,
  extra: Partial<InterfacePropertyDef> = {},
): InterfacePropertyDef {
  return { name, location, ...extra }
}

export function interfaceMethod(
  name: string,
  extra: Partial<InterfaceMethodDef> = {},
): InterfaceMethodDef {
  return { name, kind: 'method', location, params: [], ...extra }
}

export function interfaceNode(
  name: string,
  def: { properties?: InterfacePropertyDef[]; methods?: InterfaceMethodDef[] } = {},
): DocNode {
  return { ...base, name, kind: 'interface', def }
}

export function enumNode(name: string, memberNames: string[]): DocNode {
  const members: EnumMemberDef[] = memberNames.map(memberName => ({ name: memberName, location }))
  // Only the shape the WASM build really emits (`def`, not the typed `enumDef`)
  return { ...base, name, kind: 'enum', def: { members } } as unknown as DocNode
}
