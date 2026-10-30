# npmx-tui

Terminal UI for npmx.dev.

## Local development

The main npmx.dev repository currently targets Node.js 24. Keep using Node 24 for the root app, CI-equivalent checks, and existing workspace packages.

OpenTUI's native renderer requires Node.js 26.4.0+ with experimental FFI enabled. Use a Node 26.4+ runtime only when running this TUI locally.

From the repository root:

```bash
pnpm dev
```

Then, in another terminal:

```bash
pnpm npmx-tui
```

`pnpm dev` starts the local npmx.dev backend. `pnpm npmx-tui` starts the TUI, which connects to `http://127.0.0.1:3000` by default. Use Ctrl+C to exit.

For TUI watch mode:

```bash
pnpm npmx-tui:watch
```
