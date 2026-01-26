/**
 * Types for deno doc JSON output.
 *
 * These types represent the structure of the JSON output from `deno doc --json`.
 * In an ideal world, we'd generate these or implement our own AST / parser.
 * That might be an endgame, but there's a lot of value in using deno's implementation, too.
 * Well trodden ground and all that.
 *
 * @see: https://deno.land/x/deno_doc
 */

/** JSDoc tag from deno doc output */
export interface JsDocTag {
  kind: string
  name?: string
  doc?: string
  optional?: boolean
  type?: string
}

/** TypeScript type representation from deno doc */
export interface TsType {
  repr: string
  kind: string
  keyword?: string
  typeRef?: {
    typeName: string
    typeParams?: TsType[] | null
  }
  array?: TsType
  union?: TsType[]
  literal?: {
    kind: string
    string?: string
    number?: number
    boolean?: boolean
  }
}

/** Function parameter from deno doc */
export interface FunctionParam {
  kind: string
  name: string
  optional?: boolean
  tsType?: TsType
}

/** A documentation node from deno doc output */
export interface DenoDocNode {
  name: string
  kind: string
  isDefault?: boolean
  location?: {
    filename: string
    line: number
    col: number
  }
  declarationKind?: string
  jsDoc?: {
    doc?: string
    tags?: JsDocTag[]
  }
  functionDef?: {
    params?: FunctionParam[]
    returnType?: TsType
    isAsync?: boolean
    isGenerator?: boolean
    typeParams?: Array<{ name: string }>
  }
  classDef?: {
    isAbstract?: boolean
    properties?: Array<{
      name: string
      tsType?: TsType
      readonly?: boolean
      optional?: boolean
      isStatic?: boolean
      jsDoc?: { doc?: string }
    }>
    methods?: Array<{
      name: string
      isStatic?: boolean
      functionDef?: {
        params?: FunctionParam[]
        returnType?: TsType
      }
      jsDoc?: { doc?: string }
    }>
    constructors?: Array<{
      params?: FunctionParam[]
    }>
    extends?: TsType
    implements?: TsType[]
  }
  interfaceDef?: {
    properties?: Array<{
      name: string
      tsType?: TsType
      readonly?: boolean
      optional?: boolean
      jsDoc?: { doc?: string }
    }>
    methods?: Array<{
      name: string
      params?: FunctionParam[]
      returnType?: TsType
      jsDoc?: { doc?: string }
    }>
    extends?: TsType[]
    typeParams?: Array<{ name: string }>
  }
  typeAliasDef?: {
    tsType?: TsType
    typeParams?: Array<{ name: string }>
  }
  variableDef?: {
    tsType?: TsType
    kind?: string
  }
  enumDef?: {
    members?: Array<{ name: string; init?: TsType }>
  }
  namespaceDef?: {
    elements?: DenoDocNode[]
  }
}

/** Raw output from deno doc --json */
export interface DenoDocResult {
  version: number
  nodes: DenoDocNode[]
}

/** Result of documentation generation */
export interface DocsGenerationResult {
  html: string
  toc: string | null
  nodes: DenoDocNode[]
}
