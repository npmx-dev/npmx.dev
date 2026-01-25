/**
 * Prototype test for @deno/doc integration
 *
 * Goal: Generate TypeScript documentation from npm packages using @deno/doc
 */

console.log("=".repeat(60));
console.log("@deno/doc Prototype - Testing JSR Package in Node.js/Bun");
console.log("=".repeat(60));

// Step 1: Try importing @deno/doc
console.log("\n[1] Attempting to import @deno/doc...");

try {
  const denoDoc = await import("@deno/doc");
  console.log("SUCCESS: @deno/doc imported!");
  console.log("Exports:", Object.keys(denoDoc));

  // Step 2: Test with inline content via a virtual HTTPS URL
  // Note: file:// URLs don't work outside Deno, so we use HTTPS with custom loader
  console.log("\n[2] Testing doc() with inline TypeScript (virtual HTTPS URL)...");

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

  // Use a virtual HTTPS URL with a custom loader
  const virtualUrl = "https://virtual.test/mod.ts";

  const result = await denoDoc.doc([virtualUrl], {
    load(specifier) {
      console.log(`  Loading: ${specifier}`);
      if (specifier === virtualUrl) {
        return Promise.resolve({
          kind: "module",
          specifier,
          headers: { "content-type": "application/typescript" },
          content: testCode,
        });
      }
      // Return undefined for unknown imports (will be treated as external)
      return Promise.resolve(undefined);
    },
  });

  console.log("\nSUCCESS: doc() returned results!");
  console.log(`Modules documented: ${Object.keys(result).length}`);

  for (const [url, nodes] of Object.entries(result)) {
    console.log(`\nModule: ${url}`);
    console.log(`Doc nodes: ${nodes.length}`);
    for (const node of nodes) {
      console.log(`  - ${node.kind}: ${node.name}`);
      if (node.jsDoc?.doc) {
        const doc = node.jsDoc.doc.trim().replace(/\n/g, " ");
        console.log(`    JSDoc: "${doc.slice(0, 60)}${doc.length > 60 ? "..." : ""}"`);
      }
      // Show params for functions
      if (node.kind === "function" && node.functionDef?.params) {
        console.log(`    Params: ${node.functionDef.params.map((p) => p.name).join(", ")}`);
      }
      // Show properties for interfaces
      if (node.kind === "interface" && node.interfaceDef?.properties) {
        console.log(
          `    Properties: ${node.interfaceDef.properties.map((p) => p.name).join(", ")}`
        );
      }
    }
  }

  // Step 3: Test with a real npm package from jsDelivr
  console.log("\n[3] Testing with real npm package (zod) from jsDelivr...");

  const zodIndexUrl = "https://cdn.jsdelivr.net/npm/zod@3.24.0/lib/index.d.ts";

  const zodResult = await denoDoc.doc([zodIndexUrl], {
    async load(specifier) {
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
          kind: "module",
          specifier: res.url, // Use final URL after redirects
          headers: Object.fromEntries(res.headers),
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
    console.log(`Total doc nodes: ${nodes.length}`);

    // Group by kind
    const byKind = {};
    for (const node of nodes) {
      byKind[node.kind] = (byKind[node.kind] || 0) + 1;
    }
    console.log("By kind:", byKind);

    // Show first few exports
    console.log("\nFirst 15 exports:");
    for (const node of nodes.slice(0, 15)) {
      let info = `  - ${node.kind}: ${node.name}`;
      if (node.jsDoc?.doc) {
        const doc = node.jsDoc.doc.trim().split("\n")[0];
        info += ` - "${doc.slice(0, 40)}${doc.length > 40 ? "..." : ""}"`;
      }
      console.log(info);
    }
  }

  // Step 4: Test with @types package (lodash)
  console.log("\n[4] Testing with @types/lodash from jsDelivr...");

  const lodashTypesUrl =
    "https://cdn.jsdelivr.net/npm/@types/lodash@4.17.0/index.d.ts";

  const lodashResult = await denoDoc.doc([lodashTypesUrl], {
    async load(specifier) {
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
          kind: "module",
          specifier: res.url,
          headers: Object.fromEntries(res.headers),
          content,
        };
      } catch (e) {
        console.log(`    Error: ${e}`);
        return undefined;
      }
    },
  });

  console.log("\nSUCCESS: Documented @types/lodash!");
  for (const [url, nodes] of Object.entries(lodashResult)) {
    console.log(`\nModule: ${url}`);
    console.log(`Total doc nodes: ${nodes.length}`);

    const byKind = {};
    for (const node of nodes) {
      byKind[node.kind] = (byKind[node.kind] || 0) + 1;
    }
    console.log("By kind:", byKind);
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
