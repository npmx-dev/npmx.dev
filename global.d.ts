declare global {
  interface RegExpConstructor {
    escape(str: string): string
  }
}

// required for the global type to work
// oxlint-disable-next-line eslint-plugin-unicorn(require-module-specifiers)
export {}
