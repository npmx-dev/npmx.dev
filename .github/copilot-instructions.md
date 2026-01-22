# Core Requirements

- The end goal is stability, speed and great user experience.

## Code Quality Requirements

- Follow standard TypeScript conventions and best practices
- Use the Composition API when creating Vue components
- Use clear, descriptive variable and function names
- Accessibility should always be a first-class consideration and should be part of the initial planning and design.
- Add comments only to explain complex logic or non-obvious implementations
- Write unit tests for core functionality using `vitest`
- Write end-to-end tests using Playwright and `@nuxt/test-utils`
- Keep functions focused and manageable (generally under 50 lines)
- Use error handling patterns consistently
- Ensure you write strictly type-safe code, for example by ensuring you always check when accessing an array value by index
