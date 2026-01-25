/**
 * Prototype test - Using `deno doc --json` CLI
 *
 * This is the officially recommended approach for non-Deno environments.
 */

import { spawn } from "node:child_process";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

console.log("=".repeat(60));
console.log("@deno/doc Prototype - Using Deno CLI");
console.log("=".repeat(60));

/**
 * Run `deno doc --json` on a URL or file
 * @param {string} specifier - URL or file path to document
 * @returns {Promise<{version: number, nodes: object[]}>} - Doc output with nodes
 */
async function denoDoc(specifier) {
  return new Promise((resolve, reject) => {
    const args = ["doc", "--json", specifier];
    const proc = spawn("deno", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`deno doc failed (code ${code}): ${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(stdout);
        // Handle both old format (array) and new format ({ version, nodes })
        if (Array.isArray(result)) {
          resolve({ version: 0, nodes: result });
        } else {
          resolve(result);
        }
      } catch (e) {
        reject(new Error(`Failed to parse JSON: ${e.message}`));
      }
    });

    proc.on("error", reject);
  });
}

/**
 * Create a temp file with TypeScript content and document it
 * @param {string} content - TypeScript source code
 * @returns {Promise<object[]>} - Array of doc nodes
 */
async function docFromString(content) {
  const tempDir = join(tmpdir(), "deno-doc-test");
  await mkdir(tempDir, { recursive: true });
  const tempFile = join(tempDir, `test-${Date.now()}.ts`);

  try {
    await writeFile(tempFile, content);
    return await denoDoc(tempFile);
  } finally {
    await unlink(tempFile).catch(() => {});
  }
}

// Test 1: Inline TypeScript
console.log("\n[1] Testing with inline TypeScript...");

const testCode = `
/** 
 * Adds two numbers together.
 * @param a - The first number
 * @param b - The second number
 * @returns The sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Configuration options for the library.
 */
export interface Config {
  /** Enable debug mode */
  debug?: boolean;
  /** API endpoint URL */
  endpoint: string;
}

/**
 * A simple class example.
 */
export class Calculator {
  /** The current value */
  value: number = 0;
  
  /** Add a number to the current value */
  add(n: number): this {
    this.value += n;
    return this;
  }
}

/** Type alias example */
export type Handler = (event: Event) => void;
`;

try {
  const result = await docFromString(testCode);
  const nodes = result.nodes;
  console.log("SUCCESS: Got doc nodes!");
  console.log(`Total nodes: ${nodes.length}`);

  for (const node of nodes) {
    console.log(`\n  - ${node.kind}: ${node.name}`);
    if (node.jsDoc?.doc) {
      const doc = node.jsDoc.doc.trim().replace(/\n/g, " ");
      console.log(`    JSDoc: "${doc.slice(0, 60)}${doc.length > 60 ? "..." : ""}"`);
    }
    // Show function details
    if (node.kind === "function" && node.functionDef) {
      const params = node.functionDef.params?.map((p) => p.name).join(", ") || "";
      const returnType = node.functionDef.returnType?.repr || "void";
      console.log(`    Signature: (${params}) => ${returnType}`);
    }
    // Show interface properties
    if (node.kind === "interface" && node.interfaceDef?.properties) {
      const props = node.interfaceDef.properties.map((p) => p.name).join(", ");
      console.log(`    Properties: ${props}`);
    }
    // Show class members
    if (node.kind === "class" && node.classDef) {
      const props = node.classDef.properties?.map((p) => p.name).join(", ") || "";
      const methods = node.classDef.methods?.map((m) => m.name).join(", ") || "";
      if (props) console.log(`    Properties: ${props}`);
      if (methods) console.log(`    Methods: ${methods}`);
    }
  }
} catch (error) {
  console.log("FAILED:", error.message);
}

// Test 2: Remote URL (esm.sh - resolves imports correctly!)
console.log("\n\n[2] Testing with remote URL (zod@4 from esm.sh)...");

try {
  // esm.sh resolves module imports correctly, unlike jsDelivr
  const zodUrl = "https://esm.sh/zod@4.3.6?target=deno";
  console.log(`Documenting: ${zodUrl}`);

  const result = await denoDoc(zodUrl);
  const nodes = result.nodes;
  console.log(`SUCCESS: Got ${nodes.length} doc nodes!`);

  // Group by kind
  const byKind = {};
  for (const node of nodes) {
    byKind[node.kind] = (byKind[node.kind] || 0) + 1;
  }
  console.log("By kind:", byKind);

  // Show first few
  console.log("\nFirst 10 exports:");
  for (const node of nodes.slice(0, 10)) {
    let info = `  - ${node.kind}: ${node.name}`;
    if (node.jsDoc?.doc) {
      const doc = node.jsDoc.doc.trim().split("\n")[0];
      info += ` - "${doc.slice(0, 40)}${doc.length > 40 ? "..." : ""}"`;
    }
    console.log(info);
  }
} catch (error) {
  console.log("FAILED:", error.message);
}

// Test 3: More packages via esm.sh
console.log("\n\n[3] Testing more packages via esm.sh...");

const packages = [
  { name: "axios", version: "1" },
  { name: "date-fns", version: "3" },
  { name: "vue", version: "3" },
];

for (const pkg of packages) {
  try {
    const url = `https://esm.sh/${pkg.name}@${pkg.version}?target=deno`;
    console.log(`\n  ${pkg.name}@${pkg.version}:`);

    const result = await denoDoc(url);
    const nodes = result.nodes;

    const byKind = {};
    for (const node of nodes) {
      byKind[node.kind] = (byKind[node.kind] || 0) + 1;
    }
    console.log(`    ${nodes.length} nodes:`, byKind);
  } catch (error) {
    console.log(`    FAILED: ${error.message}`);
  }
}

// Test 4: @types/* fallback (express uses namespace pattern)
console.log("\n\n[4] Testing @types/express (namespace pattern)...");

try {
  const url = "https://esm.sh/@types/express@4?target=deno";
  console.log(`Documenting: ${url}`);

  const result = await denoDoc(url);
  const nodes = result.nodes;
  console.log(`Got ${nodes.length} top-level nodes`);

  // Check for namespace content
  const namespaceNode = nodes.find((n) => n.kind === "namespace");
  if (namespaceNode?.namespaceDef?.elements) {
    console.log(
      `Namespace "${namespaceNode.name}" contains ${namespaceNode.namespaceDef.elements.length} elements:`
    );
    const nsElements = namespaceNode.namespaceDef.elements.slice(0, 10);
    for (const el of nsElements) {
      console.log(`  - ${el.kind}: ${el.name}`);
    }
    if (namespaceNode.namespaceDef.elements.length > 10) {
      console.log(
        `  ... and ${namespaceNode.namespaceDef.elements.length - 10} more`
      );
    }
  }
} catch (error) {
  console.log("FAILED:", error.message);
}

console.log("\n" + "=".repeat(60));
console.log("Deno CLI test complete!");
console.log("=".repeat(60));
