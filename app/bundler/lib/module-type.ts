import type { Expression, Program, Statement, StaticMemberExpression } from '@oxc-project/types'

// #region types

export type ModuleType = 'esm' | 'cjs' | 'unknown'

/**
 * information about a module's format and exports.
 */
export interface ModuleInfo {
  /** detected module format */
  type: ModuleType
  /** whether the module has a default export */
  hasDefaultExport: boolean
  /**
   * detected named exports.
   * for ESM: export names from export statements.
   * for CJS: static property assignments to exports/module.exports.
   */
  namedExports: string[]
}

// #endregion

// #region helpers

/**
 * checks if a node is a string literal with type "Literal".
 */
function isStringLiteral(node: unknown): node is { type: 'Literal'; value: string } {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as { type: string }).type === 'Literal' &&
    typeof (node as { value: unknown }).value === 'string'
  )
}

/**
 * checks if an expression is an identifier with the given name.
 */
function isIdentifier(node: Expression | null | undefined, name: string): boolean {
  if (!node) {
    return false
  }
  // IdentifierReference and IdentifierName both have type "Identifier" and name property
  return node.type === 'Identifier' && (node as { name: string }).name === name
}

/**
 * checks if an expression is `exports` or `module.exports`.
 */
function isExportsObject(node: Expression): boolean {
  if (isIdentifier(node, 'exports')) {
    return true
  }

  // module.exports
  if (node.type === 'MemberExpression') {
    const memberExpr = node as StaticMemberExpression
    if (!memberExpr.computed) {
      const obj = memberExpr.object
      const prop = memberExpr.property
      return isIdentifier(obj, 'module') && prop.type === 'Identifier' && prop.name === 'exports'
    }
  }

  return false
}

/**
 * gets the property name from a static member expression.
 */
function getStaticPropertyName(node: StaticMemberExpression): string | null {
  if (node.computed) {
    // computed property like exports["foo"]
    const prop = node.property as unknown as Expression
    if (isStringLiteral(prop)) {
      return prop.value
    }
    return null
  }

  // non-computed like exports.foo
  const prop = node.property
  if (prop.type === 'Identifier') {
    return prop.name
  }

  return null
}

/**
 * extracts property names from an object expression (for `module.exports = { a, b }`).
 */
function extractObjectPropertyNames(node: Expression): string[] {
  if (node.type !== 'ObjectExpression') {
    return []
  }

  const names: string[] = []
  for (const prop of node.properties) {
    if (prop.type === 'SpreadElement') {
      continue
    }

    if (prop.type === 'Property') {
      const key = prop.key
      if (key.type === 'Identifier') {
        names.push((key as { name: string }).name)
      } else if (isStringLiteral(key)) {
        names.push(key.value)
      }
    }
  }

  return names
}

// #endregion

// #region detection

/**
 * checks if an expression is a require() call.
 */
function isRequireCall(expr: Expression): boolean {
  return expr.type === 'CallExpression' && isIdentifier(expr.callee as Expression, 'require')
}

/**
 * checks an expression for CJS export patterns.
 * returns the export names found, or null if not a CJS pattern.
 */
function checkCjsExpression(expr: Expression): string[] | null {
  // assignment expressions: exports.foo = ... or module.exports = ...
  if (expr.type === 'AssignmentExpression' && expr.operator === '=') {
    const left = expr.left

    // exports.foo = ... or module.exports.foo = ...
    if (left.type === 'MemberExpression') {
      const memberExpr = left as unknown as StaticMemberExpression
      const obj = memberExpr.object

      // direct assignment to exports.propertyName
      if (isExportsObject(obj)) {
        const propName = getStaticPropertyName(memberExpr)
        if (propName !== null) {
          return [propName]
        }
        return []
      }

      // module.exports = require('...') - CJS re-export
      if (isExportsObject(left as unknown as Expression)) {
        if (isRequireCall(expr.right)) {
          // re-export, we can't know the exports statically
          return []
        }
        // module.exports = { a, b }
        return extractObjectPropertyNames(expr.right)
      }
    }
  }

  // Object.defineProperty(exports, 'name', ...) or Object.defineProperty(module.exports, 'name', ...)
  if (expr.type === 'CallExpression') {
    const callee = expr.callee

    if (callee.type === 'MemberExpression') {
      const memberCallee = callee as StaticMemberExpression
      if (!memberCallee.computed && isIdentifier(memberCallee.object, 'Object')) {
        const prop = memberCallee.property
        if (prop.type === 'Identifier' && prop.name === 'defineProperty') {
          const args = expr.arguments
          const target = args[0]
          const propArg = args[1]
          if (
            target &&
            propArg &&
            target.type !== 'SpreadElement' &&
            isExportsObject(target) &&
            propArg.type !== 'SpreadElement' &&
            isStringLiteral(propArg)
          ) {
            return [propArg.value]
          }
        }
      }
    }
  }

  return null
}

/**
 * checks a statement for CJS patterns and extracts export info.
 * returns the export names found, or null if not a CJS pattern.
 */
function checkCjsStatement(stmt: Statement): string[] | null {
  // handle expression statements
  if (stmt.type === 'ExpressionStatement') {
    return checkCjsExpression(stmt.expression)
  }

  // handle if statements - check both branches for CJS patterns
  // e.g., if (process.env.NODE_ENV === 'production') module.exports = require('./prod')
  if (stmt.type === 'IfStatement') {
    let result: string[] | null = null

    // check consequent
    if (stmt.consequent.type === 'ExpressionStatement') {
      result = checkCjsExpression(stmt.consequent.expression)
    } else if (stmt.consequent.type === 'BlockStatement') {
      for (const s of stmt.consequent.body) {
        const r = checkCjsStatement(s)
        if (r !== null) {
          result = result ? [...result, ...r] : r
        }
      }
    }

    // check alternate
    if (stmt.alternate) {
      if (stmt.alternate.type === 'ExpressionStatement') {
        const r = checkCjsExpression(stmt.alternate.expression)
        if (r !== null) {
          result = result ? [...result, ...r] : r
        }
      } else if (stmt.alternate.type === 'BlockStatement') {
        for (const s of stmt.alternate.body) {
          const r = checkCjsStatement(s)
          if (r !== null) {
            result = result ? [...result, ...r] : r
          }
        }
      } else if (stmt.alternate.type === 'IfStatement') {
        const r = checkCjsStatement(stmt.alternate)
        if (r !== null) {
          result = result ? [...result, ...r] : r
        }
      }
    }

    return result
  }

  return null
}

/**
 * analyzes an Oxc AST to determine the module format and exports.
 *
 * @param ast the parsed program AST
 * @returns module info with type, default export flag, and named exports
 */
export function analyzeModule(ast: Program): ModuleInfo {
  let type: ModuleType = 'unknown'
  let hasDefaultExport = false
  const namedExports: string[] = []

  for (const node of ast.body) {
    // ESM: import declarations
    if (node.type === 'ImportDeclaration') {
      type = 'esm'
      continue
    }

    // ESM: export default
    if (node.type === 'ExportDefaultDeclaration') {
      type = 'esm'
      hasDefaultExport = true
      continue
    }

    // ESM: export all (export * from '...')
    if (node.type === 'ExportAllDeclaration') {
      type = 'esm'
      // star exports don't add to namedExports since we can't know them statically
      continue
    }

    // ESM: named exports
    if (node.type === 'ExportNamedDeclaration') {
      type = 'esm'

      // export { a, b } or export { a } from '...'
      for (const spec of node.specifiers) {
        const exported = spec.exported
        let name: string

        if (exported.type === 'Identifier') {
          name = (exported as { name: string }).name
        } else if (isStringLiteral(exported)) {
          name = exported.value
        } else {
          continue
        }

        if (name === 'default') {
          hasDefaultExport = true
        } else {
          namedExports.push(name)
        }
      }

      // export const foo = ... or export function bar() {}
      if (node.declaration) {
        const decl = node.declaration

        if (decl.type === 'VariableDeclaration') {
          for (const declarator of decl.declarations) {
            if (declarator.id.type === 'Identifier') {
              namedExports.push((declarator.id as { name: string }).name)
            }
          }
        } else if (decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') {
          if (decl.id) {
            namedExports.push((decl.id as { name: string }).name)
          }
        }
      }

      continue
    }

    // ESM: import.meta usage
    if (node.type === 'ExpressionStatement') {
      if (containsImportMeta(node.expression)) {
        type = 'esm'
        continue
      }
    }

    // CJS detection (only if not already ESM)
    if (type !== 'esm') {
      const cjsExports = checkCjsStatement(node)
      if (cjsExports !== null) {
        type = 'cjs'
        namedExports.push(...cjsExports)
      }
    }
  }

  return { type, hasDefaultExport, namedExports }
}

/**
 * recursively checks if an expression contains import.meta.
 */
function containsImportMeta(expr: Expression): boolean {
  if (expr.type === 'MetaProperty') {
    const meta = expr.meta
    const prop = expr.property
    return meta.name === 'import' && prop.name === 'meta'
  }

  if (expr.type === 'MemberExpression') {
    return containsImportMeta(expr.object as Expression)
  }

  if (expr.type === 'CallExpression') {
    // check callee and arguments
    if (containsImportMeta(expr.callee as Expression)) {
      return true
    }
    for (const arg of expr.arguments) {
      if (arg.type !== 'SpreadElement' && containsImportMeta(arg)) {
        return true
      }
    }
  }

  if (expr.type === 'BinaryExpression' || expr.type === 'LogicalExpression') {
    return containsImportMeta(expr.left as Expression) || containsImportMeta(expr.right)
  }

  if (expr.type === 'UnaryExpression') {
    return containsImportMeta(expr.argument)
  }

  if (expr.type === 'ConditionalExpression') {
    return (
      containsImportMeta(expr.test) ||
      containsImportMeta(expr.consequent) ||
      containsImportMeta(expr.alternate)
    )
  }

  return false
}

// #endregion
