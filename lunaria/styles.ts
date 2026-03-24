import { html } from './components.ts'

export const BaseStyles = html`
  <style>
    :root {
      /** Fonts */
      --ln-font-fallback:
        -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif, Apple Color Emoji,
        Segoe UI Emoji;
      --ln-font-body: 'Geist', 'IBM Plex Sans Arabic', var(--ln-font-fallback);
      --ln-font-mono: 'Geist Mono', 'IBM Plex Sans Arabic', monospace;

      /* Light theme colors */
      --ln-color-white: #f9fafb;
      --ln-color-gray-1: #f3f4f6;
      --ln-color-gray-2: #e5e7eb;
      --ln-color-gray-3: #d1d5db;
      --ln-color-gray-4: #9ca3af;
      --ln-color-gray-5: #6b7280;
      --ln-color-gray-6: #4b5563;
      --ln-color-gray-7: #374151;
      --ln-color-black: #030712;
      --ln-color-blue: #3b82f6;
      --ln-color-orange: #f97316;
      --ln-color-purple: #a855f7;
      --ln-color-green: #2edaa6; /* swatch-emerald */
      --ln-color-dark-green: #24a27c;
      --ln-color-red: #f9697c; /* swatch-coral */
      --ln-color-dark-red: #bf002d;

      /** Contextual colors */
      --ln-color-background: var(--ln-color-white);
      --ln-color-link: var(--ln-color-gray-2);
      --ln-color-link-hover: var(--ln-color-white);
      --ln-color-done: var(--ln-color-purple);
      --ln-color-outdated: var(--ln-color-orange);
      --ln-color-missing: #ef4444;
      --ln-color-table-border: var(--ln-color-gray-3);
      --ln-color-table-background: var(--ln-color-gray-1);

      --progress-bar-height: 16px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        /* Dark theme colors */
        --ln-color-white: #030712;
        --ln-color-gray-1: #374151;
        --ln-color-gray-2: #4b5563;
        --ln-color-gray-3: #6b7280;
        --ln-color-gray-4: #9ca3af;
        --ln-color-gray-5: #d1d5db;
        --ln-color-gray-6: #e5e7eb;
        --ln-color-gray-7: #f3f4f6;
        --ln-color-black: #f9fafb;
        --ln-color-blue: #60a5fa;
        --ln-color-orange: #fb923c;
        --ln-color-purple: #c084fc;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
    }

    html {
      background: var(--ln-color-background);
      scrollbar-gutter: stable;
    }

    body {
      color: var(--ln-color-black);
      display: flex;
      flex-direction: column;
      font-family: var(--ln-font-body);
      font-size: 16px;
      line-height: 1.5;
      margin-block: 2rem;
      margin-inline: 1rem;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin-bottom: 1rem;
      font-family: var(--ln-font-mono);
      font-weight: bold;
      letter-spacing: -0.025em;
      line-height: 1.3;
    }

    h1,
    h2 {
      max-width: 40ch;
    }

    h1 {
      font-size: 2.25rem;
      font-weight: 900;
    }

    h2 {
      font-size: 1.875rem;
      margin-top: 4rem;
    }

    h3,
    h4 {
      margin-top: 3rem;
    }

    h5,
    h6 {
      margin-top: 2rem;
    }

    main {
      max-width: 60ch;
      margin-inline: auto;
    }

    p + p {
      margin-top: 1.25rem;
    }

    a {
      color: var(--fg);
    }

    h2 a {
      color: inherit;
    }

    a {
      color: var(--ln-color-link);
    }

    a:hover {
      text-decoration: underline;
      color: var(--ln-color-link-hover);
    }

    ul {
      font-size: 0.875rem;
    }

    .capitalize {
      text-transform: capitalize;
    }

    details summary {
      cursor: pointer;
      user-select: none;
      color: var(--ln-color-link);
    }

    details summary::marker {
      margin-right: 0.4rem;
    }

    details summary:hover,
    details summary:hover strong,
    details summary:hover::marker {
      color: var(--ln-color-link-hover);
    }

    details p {
      margin-top: 1.2rem;
    }

    details h3 {
      margin-top: 1.2rem;
      font-size: 0.8rem;
    }

    details h4 {
      margin-top: 1rem;
      font-size: 0.8rem;
    }

    details > :last-child {
      margin-bottom: 1rem;
    }

    .lang-code {
      margin-left: 1rem;
    }

    /* Progress deatils per locale */
    .progress-details {
      border: 1px solid var(--ln-color-gray-6);
      margin-bottom: 1.25rem;
      padding: 1rem;
      border-radius: 0.5rem;
    }

    .progress-details hr {
      margin-top: 0.5rem;
      border-color: var(--ln-color-gray-6);
    }

    .progress-details a {
      font-size: 0.85rem;
    }

    .progress-summary {
      display: flex;
      justify-content: space-between;
      padding-top: 0.5rem;
      font-size: 0.8125rem;
    }

    .progress-bar-wrapper {
      height: var(--progress-bar-height);
      margin-top: 0.5rem;
      border-radius: var(--progress-bar-height);
      background-color: var(--ln-color-gray-7);
    }

    .progress-bar-wrapper .progress-bar {
      min-width: 5%;
      max-width: 100%;
      height: var(--progress-bar-height);
      border-radius: var(--progress-bar-height);
    }

    .progress-bar.completed {
      background-color: var(--ln-color-dark-green);
    }

    .progress-bar.very-good {
      background-color: var(--ln-color-green);
    }

    .progress-bar.good {
      background-color: var(--ln-color-orange);
    }

    .progress-bar.help-needed {
      background-color: var(--ln-color-red);
    }

    .progress-bar.basic {
      background-color: var(--ln-color-dark-red);
    }

    .create-button {
      padding: 0.1em 0.5em;
      font-weight: bold;
      font-size: 0.75rem;
    }

    /*Progress by files*/
    .status-by-file-wrapper {
      overflow-x: auto;
      margin-bottom: 1rem;
      border: 1px solid var(--ln-color-table-border);
      border-radius: 0.375rem;
      scrollbar-color: var(--ln-color-gray-6) var(--ln-color-gray-2);
    }

    .status-by-file {
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    .status-by-file tr:first-of-type td {
      padding-top: 0.5rem;
    }

    .status-by-file tr:last-of-type td {
      padding-bottom: 0.5rem;
    }

    .status-by-file tr td:first-of-type {
      padding-inline: 1rem;
    }

    .status-by-file th {
      border-bottom: 1px solid var(--ln-color-table-border);
      background: var(--ln-color-table-background);
      position: sticky;
      top: -1px;
      white-space: nowrap;
      padding-inline: 0.3rem;
    }

    .status-by-file th,
    .status-by-file td {
      padding-block: 0.2rem;
    }

    .status-by-file tbody tr:hover td {
      background: var(--ln-color-table-background);
    }

    .status-by-file th:first-of-type,
    .status-by-file td:first-of-type {
      text-align: left;
      padding-inline-start: 1rem;
    }

    .status-by-file th:last-of-type,
    .status-by-file td:last-of-type {
      text-align: center;
      padding-inline-end: 1rem;
    }

    .status-by-file td:not(:first-of-type) {
      min-width: 2rem;
      text-align: center;
      cursor: default;
    }

    .status-by-file td:not(:first-of-type) a {
      text-decoration: none;
    }
  </style>
`

export const CustomStyles = html`
  <style>
    :root {
      --theme-navbar-height: 6rem;
      --theme-mobile-toc-height: 4rem;
      --theme-accent-secondary: hsla(22, 100%, 60%, 1);

      --fg: oklch(98.5% 0 0);
      --fg-muted: oklch(70.9% 0 0);
      --bg: oklch(14.5% 0 0);
      --bg-subtle: oklch(17.8% 0 0);
      --border: oklch(26.9% 0 0);
      --border-subtle: oklch(23.9% 0 0);
      --border-hover: oklch(37.1% 0 0);

      --ln-color-table-background: var(--bg-subtle);
      --ln-color-table-border: var(--border);
      --ln-color-background: var(--bg);
      --ln-color-black: var(--fg);
    }

    html {
      background-color: var(--bg);
    }

    body {
      color: var(--fg);
    }

    h1,
    h2,
    h3,
    h4,
    h5 {
      color: var(--fg);
      font-weight: 500;
    }

    .progress-summary {
      color: var(--fg-muted);
    }

    p {
      color: var(--fg-muted);
    }

    .create-button {
      background-color: hsl(213deg 89% 64% / 20%);
      border-radius: 0.5em;
    }
  </style>
`
