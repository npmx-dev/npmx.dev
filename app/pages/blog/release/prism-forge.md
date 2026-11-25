---
authors:
  - name: Felix Schneider
    blueskyHandle: felixs.dev
title: 'npmx prism forge'
tags: ['OpenSource', 'Release']
excerpt: 'TODO: one or two sentences, also used as the description'
date: '2026-11-29'
slug: 'release/prism-forge'
image: 'https://npmx.dev/blog/assets/release/prism-forge/og.jpg'
description: 'TODO: same as the excerpt'
draft: true
---

<!--
  TODO before publishing:
  - excerpt + description in the frontmatter
  - co-authors? Previous release posts had 3-4 authors (Alex, Philippe, Alec, Willow,
    Daniel). Each needs a blueskyHandle for the avatar.
  - flip `draft: true` to `draft: false` (drafts are hidden from /blog and the feeds in
    production, but show in dev and previews with a "draft" banner)
  - check if more PRs landed in the v0.25.0 release PR (#3450)
  - the Svelte noodle goes live on Sun 29 Nov (= post date). If this goes out earlier,
    change the date and reword the Svelte section ("on Sunday ...")
  - check with the first-time contributors featured here (Aurora, Eugene, ...) that
    they're fine with being named
  - ask Daniel for monthly visits and TTFB/CLS numbers (photon genesis had "more than
    5 million visits a month")

  Scope: everything after v0.22.0 (29 Oct, photon genesis) up to v0.25.0
  - v0.23.0 (7 Nov): 34 PRs, 20 contributors, 23 PRs merged during the hackathon weekend
  - v0.24.0 (14 Nov): 10 PRs, 4 contributors, almost all performance
  - v0.25.0 (release PR #3450): Svelte noodle, layout shift fixes, Nuxt 4.7

  Stats:
  - 55 merged PRs (48 by people, 7 by Renovate), +13,329 / -9,841 lines
  - 24 PR authors, 8 of them first-time contributors: Ssam, Hamed, Kirby, kazupon, wkw,
    Eugene, Benjamin Canac, Aurora Scharff
  - reviews (without self-reviews): Felix 27, Roman 13, Alec 13, Daniel 8, Philippe 6,
    James 2, Wilco/cylewaitforit/t128n 1. CodeRabbit reviewed 29 of the 55.
  - merged by: Felix 21, Daniel 16, Roman 9, Philippe 5, Alec 4
  - since 29 Oct: 81 PRs opened, 28 issues closed, 20 issues opened
  - repo: 3,685 stars, 543 forks, 320 contributors (photon genesis: "more than 300")
-->

# npmx prism forge

![npmx prism forge](/blog/assets/release/prism-forge/og.jpg)

npmx is about people. We have established this since the inception in January 2026 and this fundamental value still shows in recent contributions that make npmx faster, richer, more accessible and more fun. So first and foremost, we want to thank everyone who made their first contribution to npmx in the last three releases: Ssam, Hamed, Kirby, kazuya kawaguchi, wkw, Eugene, Benjamin Canac and Aurora Scharff 🩷

<!--
  Bluesky links for later mentions (same style as crystal chronicle):

  [Daniel Roe](https://bsky.app/profile/danielroe.dev)
  [Nicolò Ribaudo](https://bsky.app/profile/nicr.dev)
  [Anthony Fu](https://bsky.app/profile/antfu.me)
  [Alec Lloyd Probert](https://bsky.app/profile/graphieros.npmx.social)
  [Philippe Serhal](https://bsky.app/profile/philippeserhal.com)
  [Roman](https://bsky.app/profile/rman.dev)
  [Matyáš Volf](https://bsky.app/profile/volfmatyas.npmx.social)
  [Wilco](https://bsky.app/profile/wilco.npmx.social)
  [James Garbutt](https://bsky.app/profile/43081j.com)
  [kazuya kawaguchi](https://bsky.app/profile/kazupon.dev)
  [Eugene](https://bsky.app/profile/outslept.bsky.social)
  [Benjamin Canac](https://bsky.app/profile/benjamincanac.dev)
  [Aurora Scharff](https://bsky.app/profile/aurorascharff.no)
  No Bluesky account, GitHub only: Ssam (drawliin), Hamed (hamedniroomand),
  Kirby (KirbyBT), wkw (wingkwong)
-->

## Svelte turns 10

Let's start with the fun part: we want to celebrate Svelte's 10<sup>th</sup> birthday on 29 November, which is exactly 10 years after its very first major release. And what better way is there to mark the anniversary of such a beloved framework than a dedicated noodle on npmx, made by Eugene as their (surprisingly) very first npmx contribution 🎊

![The npmx logo drawn in Svelte orange with the Svelte logo's curves, above the search box](/blog/assets/release/prism-forge/svelte-noodle.png)

Note that this is only 13 days after Rich Harris made the very first commit on 16 November 2016, which is why the Svelte community already partied at [Svelte Summit](https://sveltesummit.com) in Ljubljana last week. [Willow](https://bsky.app/profile/willow.sh) was there too and even brought a ton of lovely stickers:

<BlueskyPostEmbed
  url="https://bsky.app/profile/willow.sh/post/3n2jzqimsks27"
  uri="at://did:plc:dfkjiu36xs6ogt7pux7i7o2b/app.bsky.feed.post/3n2jzqimsks27"
/>

<BlueskyPostEmbed
  url="https://bsky.app/profile/svelte.dev/post/3n2gknbpbhk2r"
  uri="at://did:plc:b6gbde64ngpelprsvnphc2l2/app.bsky.feed.post/3n2gknbpbhk2r"
  show-quoted-post
/>

<details>
<summary>PRs</summary>

- **ui:** Add svelte 10th anniversary noodle ([#3448](https://github.com/npmx-dev/npmx.dev/pull/3448))

</details>

## Every forge, one client

Most public repositories of npm packages live on GitHub, which is why npmx has introduced a lot of quality-of-life features over the past months, like changelogs, repo metadata, releases, Markdown links and much more. We quickly realized that npmx should be forge-agnostic, so we ported many features to other platforms like GitLab, Tangled, Codeberg, and so on. As a lot of this hand-written code lived in the npmx repository itself, we noticed that it had become quite a mess to introduce new features for all platforms and keep each one up to date.

So [Daniel](https://bsky.app/profile/danielroe.dev), [Felix](https://bsky.app/profile/felixs.dev), and [Philippe](https://bsky.app/profile/philippeserhal.com) started working on [`forges`](https://forges.link): a dedicated npm package to interact with the most popular forges out there. At the time of writing, it supports 16 forges, from Tangled and Pushin.eu to GitCafe. Shoutout to [Anthony](https://bsky.app/profile/antfu.me) for the amazing logo design and to [oritwoen](https://bsky.app/profile/oritwoen.dev), who quickly became one of our most active contributors and added the GitBucket and GitCafe providers. This package opens up a lot of amazing possibilities to build new tools, and Philippe took on the incredible task of refactoring the whole npmx codebase to use this one package, which removed over 1,000 lines of code while keeping every forge npmx already supported, and even fixed a few of them along the way 🤯

![The forges.link capability matrix showing which operations each of the 16 forges supports](/blog/assets/release/prism-forge/forges.png)

<BlueskyPostEmbed
  url="https://bsky.app/profile/danielroe.dev/post/3mygbe6bjm22z"
  uri="at://did:plc:jbeaa5kdaladzwq3r7f5xgwe/app.bsky.feed.post/3mygbe6bjm22z"
  media-hint="video"
/>

<details>
<summary>PRs</summary>

- Read git provider data through `forges` ([#3332](https://github.com/npmx-dev/npmx.dev/pull/3332))
- Expand GitHub rate limit error message and add retry config when fetching GitHub releases ([#3304](https://github.com/npmx-dev/npmx.dev/pull/3304))

</details>

## Compare any version

<!--
  TODO: compare specific versions
  - /compare now takes `name@version`, so one package can be compared across versions
  - built by Roman (rman.dev), who opened the issue himself on 7 Mar (#1973) and closed it
    237 days later
  - nice real-world use: userquin (vite-pwa) showed @vite-pwa/nuxt v2 dropping 320
    dependencies and 89% of its install size (45.2 MB), plus a screenshot "for the
    archives", since the live comparison changes once new versions come out
  - example: https://npmx.dev/compare?packages=@vite-pwa/nuxt,@vite-pwa/nuxt@1.1.1
-->

![glob 7.2.0, 10.5.0 and 13.0.6 compared side by side: package size, install size, dependencies, deprecation, types, module format, license and vulnerabilities](/blog/assets/release/prism-forge/compare-versions.png)

<BlueskyPostEmbed
  url="https://bsky.app/profile/userquin.bsky.social/post/3n2756bvu6c2k"
  uri="at://did:plc:64htzccuyxwagilntdxo2ity/app.bsky.feed.post/3n2756bvu6c2k"
/>

<!--
  TODO (short): trust downgrade warnings now link to the file diff between the trusted and
  the downgraded version. First npmx PR by Ssam, fixes #2345 (opened by Roman on 31 Mar).
  Example: https://npmx.dev/package/reselect/v/5.1.1
-->

![A trust downgrade warning on reselect 5.1.1 with a link to the file changes](/blog/assets/release/prism-forge/trust-downgrade.png)

<details>
<summary>PRs</summary>

- Allow comparing specific versions of packages ([#3350](https://github.com/npmx-dev/npmx.dev/pull/3350))
- **ui:** Link trust downgrade warnings to version diffs ([#3358](https://github.com/npmx-dev/npmx.dev/pull/3358))

</details>

## A timeline with real history

<!--
  TODO: frozen history (#3264)

  Nicolò Ribaudo (Babel maintainer, nicr.dev): Babel 8.0.6 halved the package size, he
  opened the npmx timeline "to get my daily dopamine dose", and 8.0.6 looked almost the
  same as 8.0.5. Reason: older versions were measured with today's versions of their
  dependencies, so 8.0.5 already looked small.

  The fix works like pnpm's `--before`: each version's size is computed from the registry
  as it was before the next version came out. A "frozen history" toggle (on by default)
  switches back to "how big would this old version be if installed today". The install
  size on the package page still means "if added now", and its tooltip shows the frozen
  size. +886 lines, open 43 days, his 3rd npmx PR.
-->

![The @babel/core install size timeline with frozen history on, dropping from about 12 MB to 6 MB at 8.0.6](/blog/assets/release/prism-forge/frozen-history.png)

<!--
  TODO: pagination around the selected version (#3203)

  Anthony Fu: the timeline for nuxt@3.0.0 only listed the latest versions, and "load more"
  couldn't reach 3.0.0. Now the timeline opens around the selected version, with "load
  more" in both directions. Example: https://npmx.dev/package-timeline/nuxt/v/3.0.0

  Small one: provenance and trusted publishing now have different icons everywhere
  (#3379, Felix).

  Embed below: Philippe's pro-tip about shrinking a package's dependencies and then
  forgetting to bump it in its own dependents (links the timeline).
-->

![The nuxt timeline opened at 3.0.0, showing versions from 2.17.2 to 3.5.3 around it and a button to load newer versions](/blog/assets/release/prism-forge/timeline-pagination.png)

<BlueskyPostEmbed
  url="https://bsky.app/profile/philippeserhal.com/post/3n2adpp5rws2l"
  uri="at://did:plc:5wdnwfs45bghuedlj3rdmani/app.bsky.feed.post/3n2adpp5rws2l"
/>

<details>
<summary>PRs</summary>

- Use `--before` to show old versions in package timeline ([#3264](https://github.com/npmx-dev/npmx.dev/pull/3264))
- **ui:** Paginate the timeline around the selected version ([#3203](https://github.com/npmx-dev/npmx.dev/pull/3203))
- **ui:** Use distinct provenance and trusted publishing icons ([#3379](https://github.com/npmx-dev/npmx.dev/pull/3379))

</details>

## Charts for everyone

<!--
  TODO: fullscreen, annotations and the table view
  - charts can go fullscreen from the chart menu (Esc closes it)
  - annotations stay anchored while zooming (pairs with photon genesis' drag-to-zoom) and
    can be selected, grouped and ungrouped
  - a11y: vue-data-ui 3.29 made the hidden screen reader tables opt-in, because big charts
    were filling the DOM with hidden nodes. Small charts keep the screen reader table, big
    charts get a visible chart/table toggle. Helps everyone, not only screen reader users,
    and pages with charts get lighter.
  - vue-data-ui 3.29.1 is ~90 kB lighter
  - Alec maintains vue-data-ui, so features land upstream first and then in npmx
-->

![The weekly downloads chart for vue, and next to it the same data with table view switched on](/blog/assets/release/prism-forge/chart-table.png)

<details>
<summary>PRs</summary>

- Add fullscreen mode for charts and new annotator actions ([#3371](https://github.com/npmx-dev/npmx.dev/pull/3371))
- **a11y:** Replace hidden data tables with togglable tables for charts ([#3430](https://github.com/npmx-dev/npmx.dev/pull/3430))

</details>

## Faster, and nothing jumps

<!--
  TODO: performance (mostly 0.24, all by Daniel, all reviewed by Alec)

  Headline: the full payload is now inlined on first render (#3397). First load is only
  the HTML, no extra _payload.json request and no second server render. Uses Nuxt's
  `client` payload extraction, which was built because of what npmx needed
  (https://github.com/nuxt/nuxt/pull/34410). Also removed workaround code (+2 / -356).

  Smaller wins in the list below: no sponsor logos on every page, module replacements as
  static JSON from the CDN, one shared dependency analysis request, full renders for
  crawlers, prefetch only on interaction.

  Maybe a Speed Insights chart or numbers from Daniel here, like the TTFB chart in
  photon genesis.
-->

<details>
<summary>PRs</summary>

- Inline payload on initial render ([#3397](https://github.com/npmx-dev/npmx.dev/pull/3397))
- Sample 10% of speed insights events ([#3436](https://github.com/npmx-dev/npmx.dev/pull/3436))
- Ignore query in payload isr cache keys ([#3437](https://github.com/npmx-dev/npmx.dev/pull/3437))
- Stop loading sponsor logos on every page ([#3439](https://github.com/npmx-dev/npmx.dev/pull/3439))
- Serve module replacements as static json ([#3441](https://github.com/npmx-dev/npmx.dev/pull/3441))
- Load web analytics from the vercel observability path ([#3440](https://github.com/npmx-dev/npmx.dev/pull/3440))
- Share one dependency analysis request across components ([#3442](https://github.com/npmx-dev/npmx.dev/pull/3442))
- Render package pages in full for crawlers on isr miss ([#3443](https://github.com/npmx-dev/npmx.dev/pull/3443))
- Prefetch payload routes on interaction only ([#3444](https://github.com/npmx-dev/npmx.dev/pull/3444))

</details>

<!--
  TODO: layout shift (0.25)

  #3464 (Daniel) fixed shifts that were easy to notice:
  - the like button pushing the tabs down while the count loads
  - the Ctrl+K label turning into ⌘ K after the page loads on macOS
  - dates switching format ("Nov 23, 2026" to "23 Nov 2026") with a non-default locale
  - chart buttons and stats placeholders having a different size than the real thing
  - the back button appearing late and pushing the heading onto two lines
  plus a test so they stay fixed.

  Aurora Scharff (#3375): watched Daniel's npmx talk at JSConf MX live on 29 Oct (embed
  below). The next day she opened a PR: npmx's fonts flickered, which never happens on her
  Next.js sites, and Daniel suggested she fix it. Fonts now get long-lived caching, so no
  more flicker. Merged on 25 Nov, her first npmx PR.

  The blog got the same treatment (#3467), so this post with all its embeds shouldn't
  jump either.
-->

<BlueskyPostEmbed
  url="https://bsky.app/profile/aurorascharff.no/post/3myzuaup4l22r"
  uri="at://did:plc:o43fttmglbn4ajadwjudtqbj/app.bsky.feed.post/3myzuaup4l22r"
  show-quoted-post
/>

<details>
<summary>PRs</summary>

- Fix some layout shifts + add cls regression test ([#3464](https://github.com/npmx-dev/npmx.dev/pull/3464))
- Cache fonts and prevent font swap layout shift ([#3375](https://github.com/npmx-dev/npmx.dev/pull/3375))
- Prevent blog embeds + images from causing layout shift ([#3467](https://github.com/npmx-dev/npmx.dev/pull/3467))

</details>

## Follow the blog

<!--
  TODO: RSS and Atom
  - feeds: https://npmx.dev/blog/rss.xml and https://npmx.dev/blog/atom.xml, with
    autodiscovery, so adding https://npmx.dev/blog to a reader works too
  - built by Matyáš Volf (GitHub Kiwow, Bluesky volfmatyas.npmx.social). Longest-running PR
    of this cycle: open 197 days (17 Apr to 1 Nov), opened as a draft "so that progress on
    it is transparent". Resolves #2489, requested by kuchta.
  - the planned JSON feed was dropped: the `feed` package only keeps the first author in
    JSON Feed 1.0, and many posts here have several authors
  - idea: "if you're reading this in a feed reader, it worked"
-->

<details>
<summary>PRs</summary>

- Provide rss and atom feeds for the blog ([#2562](https://github.com/npmx-dev/npmx.dev/pull/2562))

</details>

## Also

<!--
  TODO: one or two sentences before the list ("We also fixed ..." like photon genesis).
  Fun facts:
  - #3298: vite-plus aliases `vite` to its own core package. Because plain `vite` has an
    ancient 1.0.0-rc.1, vite-plus rc.1 showed 334 packages and 6 deprecated ones instead
    of 90 and 0. (npmx itself is built with Vite+.)
  - #3278 closed the oldest issue of this cycle: #1392 by knowler, open 263 days
  - #3390 fixed an issue filed by CodeRabbit (#3384)
  - #3385 fixed an issue from TkDodo (#2785)
  - 41 locale files, big Czech update (#3399)
-->

![The node-sass deprecation notice with sass and sass-embedded as links](/blog/assets/release/prism-forge/deprecation-links.png)

- Linkify package names in deprecation notices ([#3293](https://github.com/npmx-dev/npmx.dev/pull/3293))
- Add option to reset all settings to defaults ([#3356](https://github.com/npmx-dev/npmx.dev/pull/3356))
- Resolve aliased dependencies against the aliased package ([#3298](https://github.com/npmx-dev/npmx.dev/pull/3298))
- End download charts on the latest day npm has published ([#3455](https://github.com/npmx-dev/npmx.dev/pull/3455))
- Stop truncated html showing as package description ([#3182](https://github.com/npmx-dev/npmx.dev/pull/3182))
- Render badge-only descriptions left as bare brackets as empty ([#3454](https://github.com/npmx-dev/npmx.dev/pull/3454))
- **docs:** Support `{@link target | label}` syntax ([#3276](https://github.com/npmx-dev/npmx.dev/pull/3276))
- **docs:** Resolve `{@link}` in member descriptions ([#3386](https://github.com/npmx-dev/npmx.dev/pull/3386))
- **docs:** Scroll to hash after docs render ([#3387](https://github.com/npmx-dev/npmx.dev/pull/3387))
- Correctly handle distinct version requests when resolving dependency trees ([#3390](https://github.com/npmx-dev/npmx.dev/pull/3390))
- Make the section heading toggle the section ([#3278](https://github.com/npmx-dev/npmx.dev/pull/3278))
- Keep tooltip from reappearing after opening a link in a new tab ([#3235](https://github.com/npmx-dev/npmx.dev/pull/3235))
- **i18n:** Update Czech translations ([#3399](https://github.com/npmx-dev/npmx.dev/pull/3399))

## The people

<!--
  TODO: the people section. Structure ideas:
  A) thank-you list of everyone below, first-time contributors marked
  B) three short stories (Nicolò, Aurora, the hackathon weekend), then the list
  C) "how to become a contributor": 8 first-timers this month, how to start

  Hackathon weekend (31 Oct to 1 Nov, Felix + Roman): my Bluesky post says 26 PRs merged
  in two days, 12 from distinct community contributors, 19 issues closed and 132 label
  changes on 58 items. GitHub shows 23 npmx.dev PRs merged in those two days, with 12
  distinct authors besides Felix and Roman. Double-check which number to use.

  npmx follows the "Human Voice" AI policy from ai-policy.dev (launched by James, 43081j),
  and the PR template asks contributors to write in their own voice. Several PRs say
  openly where AI helped (#3203, #3264, #3375).

  Everyone who authored a PR this cycle (first npmx PR marked with *):
  Daniel Roe (13 PRs), Felix Schneider (6), Roman (5), Alec Lloyd Probert (2), btea (2),
  cylewaitforit (2), Philippe Serhal, Anthony Fu, Nicolò Ribaudo, Wilco, Jiří Michel,
  Matyáš Volf, Bittu kumar, Zubair Ibn Zamir, Aakriti, abeer0, Ssam*, Hamed*, Kirby*,
  kazuya kawaguchi*, wkw*, Eugene*, Benjamin Canac*, Aurora Scharff*.
  Reviewers without a PR this cycle: James Garbutt (43081j), t128n.
-->

<BlueskyPostEmbed
  url="https://bsky.app/profile/felixs.dev/post/3mzbkh3usuk2h"
  uri="at://did:plc:pbjvqaziagcyv2vqodldn5op/app.bsky.feed.post/3mzbkh3usuk2h"
/>

<BlueskyPostEmbed
  url="https://bsky.app/profile/43081j.com/post/3mzkq6f52y224"
  uri="at://did:plc:7kxnbhtvb5cltkh6gaolfodf/app.bsky.feed.post/3mzkq6f52y224"
/>

## Events

<!--
  TODO: events since the last post
  - JSConf MX (29 Oct): Daniel's talk about open source and npmx. Recording?
  - async Brighton meetup (12 Nov): Willow brought npmx stickers
  - Svelte Summit (19-20 Nov, Ljubljana): Willow brought npmx merch
  - optional: Kevin Powell talked with Daniel about open source and why it still matters
    to understand code when agents write it
  - optional: more and more people link npmx pages in their release posts (Stylelint 18,
    vite-pwa, @dasl tiles)
-->

<BlueskyPostEmbed
  url="https://bsky.app/profile/willow.sh/post/3n2nv5dquec2w"
  uri="at://did:plc:dfkjiu36xs6ogt7pux7i7o2b/app.bsky.feed.post/3n2nv5dquec2w"
/>

<BlueskyPostEmbed
  url="https://bsky.app/profile/kevinpowell.co/post/3n2opetr4is22"
  uri="at://did:plc:xbj7qbl7qmoo7dpf5dheplex/app.bsky.feed.post/3n2opetr4is22"
  media-hint="video"
/>

## What's next

<!--
  TODO: tease 3-5 things in progress (all open PRs, not in 0.25):
  - package collections on ATproto: create, like, follow, browse, "found in collections"
    on package pages (Philippe, #3420 to #3426)
  - issues, stars and forks for every forge (#3413) and a forges caching proxy instead of
    ungh.cc (#3458)
  - social mentions on package pages (#3414)
  - copy package docs as Markdown (#3445), view and copy .diff files (#3456)
  - drag-to-zoom on the timeline (#3446), autocomplete with instant search off (#3449)
  - Nuxt 5 (#3376)
  Optional: Philippe's rejected Halloween jump scare noodle (video post below).
-->

<BlueskyPostEmbed
  url="https://bsky.app/profile/philippeserhal.com/post/3mz7novwqnk2g"
  uri="at://did:plc:5wdnwfs45bghuedlj3rdmani/app.bsky.feed.post/3mz7novwqnk2g"
  media-hint="video"
/>

## Join us

<!--
  TODO: closing. The circle: everyone who uses npmx can help build it. 8 people made their
  first npmx PR this month, the next one could be anyone reading this.
-->

[Site](https://npmx.dev) • [Builders Discord](https://build.npmx.dev/) • [GitHub](https://repo.npmx.dev/) • [Bluesky](https://social.npmx.dev/)
