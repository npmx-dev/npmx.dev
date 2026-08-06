export default defineNuxtPlugin({
  env: { islands: false },
  setup() {
    if (import.meta.server || import.meta.test) {
      return
    }

    // oxlint-disable-next-line no-console
    console.log(
      '%c./ welcome\n\n%cnpmx.dev is a community-driven open-source platform built by people, for people. If you have ideas or want to help us keep improving the developer experience, join us at https://build.npmx.dev',
      'font: bold 24px system-ui, sans-serif; color: oklch(0.787 0.128 230.318); padding-top: 12px;',
      'font: 16px system-ui, sans-serif; padding-bottom: 12px;',
    )

    // oxlint-disable-next-line no-console
    console.log(
      '%c⚠️ warning\n\n%cRunning code here will have access to your local data and some cookies. Please review the code carefully before pasting and executing it.',
      'font: bold 20px system-ui, sans-serif; color: oklch(0.79 0.17 70.66); padding-top: 12px;',
      'font: 16px system-ui, sans-serif; padding-bottom: 12px;',
    )
  },
})
