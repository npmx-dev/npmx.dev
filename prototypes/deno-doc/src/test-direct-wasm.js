/**
 * Prototype test - Direct WASM loading to bypass file:// URL limitation
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

console.log("=".repeat(60));
console.log("@deno/doc Prototype - Direct WASM Loading");
console.log("=".repeat(60));

// Find the WASM file path
const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPath = join(
  __dirname,
  "../../../node_modules/.pnpm/@jsr+deno__doc@0.189.1/node_modules/@jsr/deno__doc/deno_doc_wasm_bg.wasm"
);

console.log("\n[1] Loading WASM file directly...");
console.log(`WASM path: ${wasmPath}`);

try {
  // Read WASM bytes
  const wasmBytes = readFileSync(wasmPath);
  console.log(`WASM size: ${wasmBytes.length} bytes`);

  // Import the generated JS module to get the imports and exports setup
  // Use full path since subpath exports aren't defined
  const wasmGenerated = await import(
    "../../../node_modules/.pnpm/@jsr+deno__doc@0.189.1/node_modules/@jsr/deno__doc/deno_doc_wasm.generated.js"
  );
  console.log("Generated JS exports:", Object.keys(wasmGenerated));

  // Try to instantiate with the bytes directly
  console.log("\n[2] Instantiating WASM...");

  // The instantiate function should accept url option
  const instance = await wasmGenerated.instantiate({
    // Provide WASM bytes via a data URL or custom approach
    url: new URL(
      `data:application/wasm;base64,${wasmBytes.toString("base64")}`
    ),
  });

  console.log("SUCCESS: WASM instantiated!");
  console.log("Instance exports:", Object.keys(instance));
} catch (error) {
  console.log("FAILED:", error.message);

  // Alternative: Try using the instantiate with WebAssembly directly
  console.log("\n[3] Trying alternative: WebAssembly.instantiate directly...");

  try {
    const wasmBytes = readFileSync(wasmPath);

    // We need the imports object from the generated file
    // This is hacky but let's see if we can make it work
    const { imports } = await import(
      "../../../node_modules/.pnpm/@jsr+deno__doc@0.189.1/node_modules/@jsr/deno__doc/deno_doc_wasm.generated.js"
    ).then((m) => ({ imports: m.imports || {} }));

    const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
    console.log("SUCCESS: Direct WebAssembly instantiation!");
    console.log("Instance exports:", Object.keys(instance.exports));
  } catch (e2) {
    console.log("Also FAILED:", e2.message);
  }
}

console.log("\n" + "=".repeat(60));
console.log("Direct WASM test complete");
console.log("=".repeat(60));
