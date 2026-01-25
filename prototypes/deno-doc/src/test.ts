/**
 * Prototype test for @deno/doc integration
 *
 * Goal: Generate TypeScript documentation from npm packages using @deno/doc
 */

export {};

console.log("=".repeat(60));
console.log("@deno/doc Prototype - Testing JSR Package in Node.js");
console.log("=".repeat(60));

// Step 1: Try importing @deno/doc
console.log("\n[1] Attempting to import @deno/doc...");

try {
  const denoDoc = await import("@deno/doc");
  console.log("SUCCESS: @deno/doc imported!");
  console.log("Exports:", Object.keys(denoDoc));

  // Step 2: Try using the doc() function with a custom loader
  console.log("\n[2] Testing doc() with inline TypeScript...");

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
`;

  const result = await denoDoc.doc(["file:///test.ts"], {
    load(specifier: string) {
      console.log(`  Loading: ${specifier}`);
      if (specifier === "file:///test.ts") {
        return Promise.resolve({
          kind: "module" as const,
          specifier,
          content: testCode,
        });
      }
      return Promise.resolve(undefined);
    },
  });

  console.log("\nSUCCESS: doc() returned results!");
  console.log(`Modules documented: ${Object.keys(result).length}`);

  for (const [url, nodes] of Object.entries(result)) {
    console.log(`\nModule: ${url}`);
    console.log(`Doc nodes: ${(nodes as any[]).length}`);
    for (const node of nodes as any[]) {
      console.log(`  - ${node.kind}: ${node.name}`);
      if (node.jsDoc?.doc) {
        console.log(`    "${node.jsDoc.doc.slice(0, 50)}..."`);
      }
    }
  }

  // Step 3: Test with a real npm package from jsDelivr
  console.log("\n[3] Testing with real npm package (zod) from jsDelivr...");

  const zodDtsUrl = "https://cdn.jsdelivr.net/npm/zod@3.24.0/lib/types.d.ts";

  const zodResult = await denoDoc.doc([zodDtsUrl], {
    async load(specifier: string) {
      console.log(`  Loading: ${specifier}`);
      try {
        const res = await fetch(specifier);
        if (!res.ok) {
          console.log(`    Failed: ${res.status}`);
          return undefined;
        }
        const content = await res.text();
        console.log(`    Loaded ${content.length} bytes`);
        return {
          kind: "module" as const,
          specifier: res.url,
          content,
        };
      } catch (e) {
        console.log(`    Error: ${e}`);
        return undefined;
      }
    },
  });

  console.log("\nSUCCESS: Documented zod package!");
  for (const [url, nodes] of Object.entries(zodResult)) {
    console.log(`\nModule: ${url}`);
    console.log(`Total doc nodes: ${(nodes as any[]).length}`);

    // Group by kind
    const byKind: Record<string, number> = {};
    for (const node of nodes as any[]) {
      byKind[node.kind] = (byKind[node.kind] || 0) + 1;
    }
    console.log("By kind:", byKind);

    // Show first few
    console.log("\nFirst 10 exports:");
    for (const node of (nodes as any[]).slice(0, 10)) {
      console.log(`  - ${node.kind}: ${node.name}`);
    }
  }
} catch (error) {
  console.log("FAILED:", error);
  if (error instanceof Error) {
    console.log("Stack:", error.stack);
  }
}

console.log("\n" + "=".repeat(60));
console.log("Prototype test complete");
console.log("=".repeat(60));
