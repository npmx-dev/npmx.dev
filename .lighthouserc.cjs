const fs = require('fs')

// Auto-detect Chrome executable path
function findChrome() {
  const paths = [
    // Linux
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ]

  for (const p of paths) {
    if (fs.existsSync(p)) return p
  }

  return undefined
}

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm preview',
      startServerReadyPattern: 'Listening',
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/search?q=nuxt',
        'http://localhost:3000/nuxt',
      ],
      numberOfRuns: 1,
      chromePath: findChrome(),
      puppeteerScript: './lighthouse-setup.cjs',
      settings: {
        onlyCategories: ['accessibility'],
        skipAudits: ['valid-source-maps'],
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['warn', { minScore: 1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
