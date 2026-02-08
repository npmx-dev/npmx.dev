# npmx.dev

> A fast, modern browser for the npm registry.

<p align="center">
  <a href="https://npmx.dev/">
    <img width="1090" alt="Screenshot of npmx.dev showing the nuxt package" src="https://github.com/user-attachments/assets/1a2a3205-0227-46dc-b1f9-48f9a65691d3">
  </a>
</p>

- [👉 &nbsp;Check it out](https://npmx.dev/)
- [📖 &nbsp;About npmx](https://npmx.dev/about)

## Vision

The goal of [npmx.dev](https://npmx.dev) is to build a fast, modern browser for the npm registry.

We're not replacing the [npm](https://www.npmjs.com/) registry, but instead providing an elevated developer experience through a fast, modern UI.

What npmx offers:

- **Speed** &ndash; Fast searching, filtering, and navigation.
- **Simplicity** &ndash; Get the information you need when you need it in an intuitive UI.
- **URL Compatibility** &ndash; Replace `npmjs.com` with `xnpmjs.com` or `npmx.dev` in any URL and it just works.
- **Enhanced admin experience** &ndash; Manage your packages, teams, and organizations from the browser, powered by your local npm CLI.

## Shortcuts

> [!IMPORTANT]  
> We're keeping the website, repository, and our discord community low-profile until the browser is polished enough. We'll do a formal announcement at that point. Please avoid sharing the website or the invite link to discord on social media directly. The repo is public, so people who care about the project can easily find it and join us. Anyone who wants to help is more than welcome to [join the community](https://chat.npmx.dev). If you know others who would be interested, please invite them too!

- [chat.npmx.dev](https://chat.npmx.dev) - Discord Server
- [social.npmx.dev](https://social.npmx.dev) - Bluesky Profile
- [repo.npmx.dev](https://repo.npmx.dev) - GitHub Repository
- [issues.npmx.dev](https://issues.npmx.dev) - GitHub Issues
- [coc.npmx.dev](https://coc.npmx.dev) - Code of Conduct
- [contributing.npmx.dev](https://contributing.npmx.dev) - Contributing Guide

## Features

### Package browsing

- **Dark mode and light mode** &ndash; plus customize the color palette to your preferences
- **Fast search** &ndash; quick package search with instant results
- **Package details** &ndash; READMEs, versions, dependencies, and metadata
- **Code viewer** &ndash; browse package source code with syntax highlighting and permalink to specific lines
- **Provenance indicators** &ndash; verified build badges and provenance section below the README
- **Multi-provider repository support** &ndash; stars/forks from GitHub, GitLab, Bitbucket, Codeberg, Gitee, Sourcehut, Forgejo, Gitea, Radicle, and Tangled
- **JSR availability** &ndash; see if scoped packages are also available on JSR
- **Package badges** &ndash; module format (ESM/CJS/dual), TypeScript types (with `@types/*` links), and engine constraints
- **Outdated dependency indicators** &ndash; visual cues showing which dependencies are behind
- **Vulnerability warnings** &ndash; security advisories from the OSV database
- **Download statistics** &ndash; weekly download counts with sparkline charts
- **Install size** &ndash; total install size (including transitive dependencies)
- **Playground links** &ndash; quick access to StackBlitz, CodeSandbox, and other demo environments from READMEs
- **Infinite search** &ndash; auto-load additional search pages as you scroll
- **Keyboard navigation** &ndash; press `/` to focus search, `.` to open code viewer, arrow keys to navigate results
- **Deprecation notices** &ndash; clear warnings for deprecated packages and versions
- **Version range resolution** &ndash; dependency ranges (e.g., `^1.0.0`) resolve to actual installed versions
- **Claim new packages** &ndash; register new package names directly from search results (via local connector)
- **Clickable version tags** &ndash; navigate directly to any version from the versions list

### User & org pages

- **User profiles** &ndash; view any npm user's public packages at `/~username`
- **Organization pages** &ndash; browse org packages at `/@orgname`
- **Search, filter & sort** &ndash; find packages within user/org lists
- **Infinite scroll** &ndash; paginated lists that load as you scroll

### Comparison with npmjs.com

| Feature                        | npmjs.com | npmx.dev |
| ------------------------------ | :-------: | :------: |
| Package search                 |    ✅     |    ✅    |
| Package details & README       |    ✅     |    ✅    |
| Version history                |    ✅     |    ✅    |
| Dependencies list              |    ✅     |    ✅    |
| User profiles                  |    ✅     |    ✅    |
| Organization pages             |    ✅     |    ✅    |
| Provenance indicators          |    ✅     |    ✅    |
| Code browser                   |    ✅     |    ✅    |
| Dark mode                      |    ❌     |    ✅    |
| Outdated dependency warnings   |    ❌     |    ✅    |
| Module format badges (ESM/CJS) |    ❌     |    ✅    |
| TypeScript types indicator     |    ✅     |    ✅    |
| Install size calculation       |    ❌     |    ✅    |
| JSR cross-reference            |    ❌     |    ✅    |
| Vulnerability warnings         |    ✅     |    ✅    |
| Deprecation notices            |    ✅     |    ✅    |
| Download charts                |    ✅     |    ✅    |
| Playground links               |    ❌     |    ✅    |
| Keyboard navigation            |    ❌     |    ✅    |
| Multi-provider repo support    |    ❌     |    ✅    |
| Version range resolution       |    ❌     |    ✅    |
| Dependents list                |    ✅     |    🚧    |
| Package admin (access/owners)  |    ✅     |    🚧    |
| Org/team management            |    ✅     |    🚧    |
| 2FA/account settings           |    ✅     |    ❌    |
| Claim new package names        |    ✅     |    ✅    |

🚧 = coming soon

## URL structure

### npm compatibility

npmx.dev supports npm permalinks &ndash; just replace `npmjs.com` with `npmx.dev` or `xnpmjs.com` to get the npmx experience:

| npm URL                         | npmx.dev equivalent                                                    |
| ------------------------------- | ---------------------------------------------------------------------- |
| `npmjs.com/package/nuxt`        | [`npmx.dev/package/nuxt`](https://npmx.dev/package/nuxt)               |
| `npmjs.com/package/@nuxt/kit`   | [`npmx.dev/package/@nuxt/kit`](https://npmx.dev/package/@nuxt/kit)     |
| `npmjs.com/package/vue/v/3.4.0` | [`npmx.dev/package/vue/v/3.4.0`](https://npmx.dev/package/vue/v/3.4.0) |
| `npmjs.com/search?q=vue`        | [`npmx.dev/search?q=vue`](https://npmx.dev/search?q=vue)               |
| `npmjs.com/~sindresorhus`       | [`npmx.dev/~sindresorhus`](https://npmx.dev/~sindresorhus)             |
| `npmjs.com/org/nuxt`            | [`npmx.dev/org/nuxt`](https://npmx.dev/org/nuxt)                       |

> [!TIP]
> Want automatic redirects? Try the [npmx-replace browser extension](https://github.com/tylersayshi/npmx-replace-extension) (Chrome only for now).

#### Not yet supported

- `/package/<name>/access` &ndash; package access settings
- `/package/<name>/dependents` &ndash; dependent packages list
- `/settings/*` &ndash; account settings pages

### Simpler URLs

npmx.dev also supports shorter, cleaner URLs:

| Pattern            | Example                                            |
| ------------------ | -------------------------------------------------- |
| `/<package>`       | [`/nuxt`](https://npmx.dev/nuxt)                   |
| `/<pkg>@<version>` | [`/vue@3.4.0`](https://npmx.dev/vue@3.4.0)         |
| `/@scope/name`     | [`/@nuxt/kit`](https://npmx.dev/@nuxt/kit)         |
| `/@org`            | [`/@nuxt`](https://npmx.dev/@nuxt)                 |
| `/~username`       | [`/~sindresorhus`](https://npmx.dev/~sindresorhus) |

## Tech stack

- [Nuxt 4](https://nuxt.com/)
- [Nitro](https://nuxt.com/docs/guide/concepts/server-engine)
- [UnoCSS](https://unocss.dev/)
- [nuxt-og-image](https://github.com/nuxt-modules/og-image)
- [npm Registry API](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md)

## Contributing

We welcome contributions &ndash; please do feel free to explore the project and improve things. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to get up and running!

## Related projects

- [npmx-replace-extension](https://github.com/tylersayshi/npmx-replace-extension) &ndash; Browser extension to redirect npmjs.com to npmx.dev (Chrome only for now)
- [JSR](https://jsr.io/) &ndash; The open-source package registry for modern JavaScript and TypeScript
- [npm-userscript](https://github.com/bluwy/npm-userscript) &ndash; Browser userscript with various improvements and fixes for npmjs.com
- [npm-alt](https://npm.willow.sh/) &ndash; An alternative npm package browser
- [npkg.lorypelli.dev](https://npkg.lorypelli.dev/) &ndash; An alternative frontend to npm made with as little client-side JavaScript as possible
- [vscode-npmx](https://github.com/npmx-dev/vscode-npmx) &ndash; VSCode extension for npmx
- [nxjt](https://nxjt.netlify.app) &ndash; npmx Jump To: Quickly navigate to npmx common webpages.
- [npmx-weekly](https://npmx-weekly.trueberryless.org/) &ndash; A weekly newsletter for the npmx ecosystem. Add your own content via suggestions in the weekly PR on [GitHub](https://github.com/trueberryless-org/npmx-weekly/pulls?q=is%3Aopen+is%3Apr+label%3A%22%F0%9F%95%94+weekly+post%22).
- [npmx-digest](https://npmx-digest.trueberryless.org/) &ndash; An automated news aggregation website that summarizes npmx activity from GitHub and Bluesky every 8 hours.

If you're building something cool, let us know! 🙏

## License

Made with ❤️

Published under [MIT License](./LICENSE).

## Star History

<a href="https://www.star-history.com/#npmx-dev/npmx.dev&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=npmx-dev/npmx.dev&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=npmx-dev/npmx.dev&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=npmx-dev/npmx.dev&type=date&legend=top-left" />
 </picture>
</a>
