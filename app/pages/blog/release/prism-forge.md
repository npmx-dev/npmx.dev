---
authors:
  - name: Felix Schneider
    blueskyHandle: felixs.dev
  - name: Matias Capeletto
    blueskyHandle: patak.cat
  - name: Eugene
    blueskyHandle: outslept.bsky.social
title: 'npmx prism forge'
tags: ['OpenSource', 'Release']
excerpt: 'npmx 0.25 is out, with a Svelte birthday noodle, one client for every forge, version comparisons, a timeline with real history, more accessible charts, faster pages, and blog feeds.'
date: '2026-11-29'
slug: 'release/prism-forge'
image: 'https://npmx.dev/blog/assets/release/prism-forge/og.jpg'
description: 'npmx 0.25 is out, with a Svelte birthday noodle, one client for every forge, version comparisons, a timeline with real history, more accessible charts, faster pages, and blog feeds.'
draft: false
---

# npmx prism forge

![npmx prism forge](/blog/assets/release/prism-forge/og.jpg)

npmx is about people. We have lived by this since npmx's inception in January 2026, and this fundamental value still shows in recent contributions that make npmx faster, richer, more accessible, and more fun. So first and foremost, we want to thank everyone who made their first contribution to npmx in the last three releases: [Ssam](https://github.com/drawliin), [Hamed](https://github.com/hamedniroomand), [Kirby](https://github.com/KirbyBT), [kazuya](https://bsky.app/profile/kazupon.dev), [wkw](https://github.com/wingkwong), [Eugene](https://bsky.app/profile/outslept.bsky.social), [Benjamin](https://bsky.app/profile/benjamincanac.dev), and [Aurora](https://bsky.app/profile/aurorascharff.no) 🩷

## Svelte turns 10

Let's start with the fun part: we want to celebrate Svelte's 10<sup>th</sup> birthday on 29 November, which is exactly 10 years after its very first major release. And what better way is there to mark the anniversary of such a beloved framework than a dedicated noodle on npmx, made by [Eugene](https://bsky.app/profile/outslept.bsky.social), collaborating with [Alex](https://bsky.app/profile/alexdln.com) and others, as his (surprisingly) very first npmx contribution 🎊

![The npmx logo drawn in Svelte orange with the Svelte logo's curves, above the search box](/blog/assets/release/prism-forge/svelte-noodle.png)

Note that this is only 13 days after [Rich Harris](https://bsky.app/profile/rich-harris.dev) made the very first commit on 16 November 2016, which is why the Svelte community already partied at [Svelte Summit](https://sveltesummit.com) in Ljubljana last week (yes, with cake). [Willow](https://bsky.app/profile/willow.sh) was there too and even brought a ton of lovely stickers:

<BlueskyPostEmbed
  url="https://bsky.app/profile/willow.sh/post/3n2jzqimsks27"
  uri="at://did:plc:dfkjiu36xs6ogt7pux7i7o2b/app.bsky.feed.post/3n2jzqimsks27"
/>

<BlueskyPostEmbed
  url="https://bsky.app/profile/svelte.dev/post/3n2gknbpbhk2r"
  uri="at://did:plc:b6gbde64ngpelprsvnphc2l2/app.bsky.feed.post/3n2gknbpbhk2r"
  show-quoted-post
/>

True to the closing words of Rich's lovely [look back on ten years of Svelte](https://svelte.dev/blog/ten-years-of-svelte): "We're a decade in, and our best years are still ahead of us." Happy birthday, Svelte 🧡

<details>
<summary>PRs</summary>

- **ui:** Add svelte 10th anniversary noodle ([#3448](https://github.com/npmx-dev/npmx.dev/pull/3448))

</details>

## Every forge, one client

Most public repositories of npm packages live on GitHub, which is why npmx has introduced a lot of quality-of-life features over the past months, like changelogs, repo metadata, releases, Markdown links, and much more. We quickly realized that npmx should be forge-agnostic, so we ported many features to other platforms like GitLab, tangled, Codeberg, and so on. As a lot of this hand-written code lived in the npmx repository itself, we noticed that it had become quite a mess to introduce new features for all platforms and keep each one up to date.

So [Daniel](https://bsky.app/profile/danielroe.dev), [Felix](https://bsky.app/profile/felixs.dev), and [Philippe](https://bsky.app/profile/philippeserhal.com) started working on [`forges`](https://forges.link): a dedicated npm package to interact with the most popular forges out there. At the time of writing, it supports 16 forges, from [tangled](https://tangled.org/) and [Pushin.eu](https://pushin.eu/) to [GitCafe](https://git.cafe/). Shoutout to [Anthony](https://bsky.app/profile/antfu.me) for the amazing logo design and to [oritwoen](https://bsky.app/profile/oritwoen.dev), who quickly became one of our most active contributors and added the GitBucket and GitCafe providers. This package opens up a lot of amazing possibilities to build new tools, and Philippe took on the incredible task of refactoring the whole npmx codebase to use this one package, which removed over 1,000 lines of code while keeping every forge npmx already supported, and even fixed a few of them along the way 🤯

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

One of the longest-requested features, open since back in March, was the ability to compare specific versions of packages instead of only the latest one. Thankfully, [Roman](https://bsky.app/profile/rman.dev) had a free week before going back to studying, and he used it to contribute a lot. This feature was one of his contributions. It now also allows comparing different versions of the same package to see how it developed, like in the following `glob` example 📉

![glob 7.2.0, 10.5.0 and 13.0.6 compared side by side: package size, install size, dependencies, deprecation, types, module format, license, and vulnerabilities](/blog/assets/release/prism-forge/compare-versions.png)

<BlueskyPostEmbed
  url="https://bsky.app/profile/userquin.bsky.social/post/3n2756bvu6c2k"
  uri="at://did:plc:64htzccuyxwagilntdxo2ity/app.bsky.feed.post/3n2756bvu6c2k"
/>

Another small feature that goes hand in hand with differences between versions of a package is a convenient link in trust downgrade warnings to the file diff between the trusted and the downgraded version. This was also [Ssam](https://github.com/drawliin)'s very first npmx PR 🎉

![A trust downgrade warning on reselect 5.1.1 with a link to the file changes](/blog/assets/release/prism-forge/trust-downgrade.png)

<details>
<summary>PRs</summary>

- Allow comparing specific versions of packages ([#3350](https://github.com/npmx-dev/npmx.dev/pull/3350))
- **ui:** Link trust downgrade warnings to version diffs ([#3358](https://github.com/npmx-dev/npmx.dev/pull/3358))

</details>

## A timeline with real history

When [Nicolò](https://bsky.app/profile/nicr.dev) and the Babel team halved the package size with Babel `8.0.6`, he wanted to see it on the satisfying npmx timeline, but realized that versions `8.0.5` and `8.0.6` looked almost the same. After a little bit of digging, it turned out that older versions in the timeline were measured with today's versions of their dependencies. Eager to contribute his third improvement to npmx, Nicolò sent a fix the very same day, and now we can all see the amazing effort that went into reducing the install size. Thank you!

![The @babel/core install size timeline with frozen history on, dropping from about 12 MB to 6 MB at 8.0.6](/blog/assets/release/prism-forge/frozen-history.png)

Another timeline improvement comes from [Anthony](https://bsky.app/profile/antfu.me): when he opened the timeline for `nuxt@3.0.0`, it only listed the latest versions, and "load more" couldn't get anywhere near `3.0.0`. A timeline that stays safe in the harbor of the latest releases is not what timelines are built for, so Anthony made it open right around the version you selected, with "load more" in both directions.

![The nuxt timeline opened at 3.0.0, showing versions from 2.17.2 to 3.5.3 around it and a button to load newer versions](/blog/assets/release/prism-forge/timeline-pagination.png)

<BlueskyPostEmbed
  url="https://bsky.app/profile/philippeserhal.com/post/3n2adpp5rws2l"
  uri="at://did:plc:5wdnwfs45bghuedlj3rdmani/app.bsky.feed.post/3n2adpp5rws2l"
/>

While browsing the timeline, [Felix](https://bsky.app/profile/felixs.dev) noticed that it used a fingerprint icon for provenance, but the rest of npmx showed provenance with the same shield icon as trusted publishing. With some help from [Philippe](https://bsky.app/profile/philippeserhal.com), provenance now gets the fingerprint everywhere and trusted publishing keeps the shield, so you can tell the two apart at a glance, wherever you look.

<details>
<summary>PRs</summary>

- Use `--before` to show old versions in package timeline ([#3264](https://github.com/npmx-dev/npmx.dev/pull/3264))
- **ui:** Paginate the timeline around the selected version ([#3203](https://github.com/npmx-dev/npmx.dev/pull/3203))
- **ui:** Use distinct provenance and trusted publishing icons ([#3379](https://github.com/npmx-dev/npmx.dev/pull/3379))

</details>

## Charts for everyone

Charts are one of the quickest ways to get a feeling for a package, so it's great to see them getting better with every release. Since [Alec](https://bsky.app/profile/graphieros.npmx.social) maintains `vue-data-ui`, the chart library behind npmx, new chart features usually land there first and then make their way into npmx. This time, every chart got a fullscreen mode right in the chart menu, and the built-in annotator learned some new tricks: annotations now stay anchored to the chart and move along when you use the drag-to-zoom from the last release, and they can be selected, grouped, and ungrouped 📊

Accessibility got some love as well. Until now, every chart came with a hidden data table for screen readers, which filled the page with hidden elements, especially for charts with a lot of data. So with `vue-data-ui@3.29.0`, those tables became opt-in: small charts still keep their screen reader table, while bigger charts now get a visible toggle to switch between the chart and a table view. That doesn't only help screen reader users, but is also handy whenever you want to check the exact numbers. And as a nice bonus, pages with charts got lighter, and `vue-data-ui@3.29.1` is about 90 kB smaller 🙌

![The weekly downloads chart for vue, and next to it the same data with table view switched on](/blog/assets/release/prism-forge/chart-table.png)

<details>
<summary>PRs</summary>

- Add fullscreen mode for charts and new annotator actions ([#3371](https://github.com/npmx-dev/npmx.dev/pull/3371))
- **a11y:** Replace hidden data tables with togglable tables for charts ([#3430](https://github.com/npmx-dev/npmx.dev/pull/3430))

</details>

## Faster, and nothing jumps

Under the hood, [Daniel](https://bsky.app/profile/danielroe.dev) kept squeezing out milliseconds. The first page load now comes with all its data inlined, so there's no extra request and no second render on the server, using a Nuxt feature that was [built because of what npmx needed](https://github.com/nuxt/nuxt/pull/34410). On top of that, code, docs, and changelog pages are now served as a tiny static shell: a code page for `next` went from 2.2 MB of HTML to just 9.4 KB. And if you're not logged in, npmx no longer checks your session and likes on every page view, which saves more than 9 million requests a week ⚡

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
- Serve code and docs pages from static client-only shell ([#3479](https://github.com/npmx-dev/npmx.dev/pull/3479))
- Serve changelogs from a static client-only shell ([#3480](https://github.com/npmx-dev/npmx.dev/pull/3480))
- Skip `/api/auth/session` for anonymous visitors ([#3472](https://github.com/npmx-dev/npmx.dev/pull/3472))
- Cache public like counts + skip per-user status for anonymous visitors ([#3474](https://github.com/npmx-dev/npmx.dev/pull/3474))

</details>

And nothing jumps anymore: Daniel fixed a bunch of small layout shifts, both on page load and when navigating between pages, for example the like button pushing the tabs down while loading, and added tests so they stay fixed. The last one was a font flicker that [Aurora](https://bsky.app/profile/aurorascharff.no) spotted right after watching Daniel's npmx talk at JSConf MX, because it never happens on Aurora's own Next.js sites. One PR later, the fonts are cached properly, and it was Aurora's very first npmx contribution 🎉

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
- Fix some client-side nav layout shift ([#3469](https://github.com/npmx-dev/npmx.dev/pull/3469))
- Prevent some layout shift on blog pages ([#3484](https://github.com/npmx-dev/npmx.dev/pull/3484))
- Prevent layout shift on short package lists + blog media ([#3485](https://github.com/npmx-dev/npmx.dev/pull/3485))

</details>

## Follow the blog

And if you like reading these posts: you can now follow this blog in your favorite feed reader! [Matyáš](https://bsky.app/profile/volfmatyas.npmx.social) added [RSS](https://npmx.dev/blog/rss.xml) and [Atom](https://npmx.dev/blog/atom.xml) feeds, and since readers can discover them on their own, simply adding https://npmx.dev/blog works too. So if you're reading this in a feed reader: it worked 📰

![The merged pull request "feat: provide rss and atom feeds for the blog", with its plan to generate the feeds at build time, serve them, and let readers discover them](/blog/assets/release/prism-forge/rss-pr.png)

<details>
<summary>PRs</summary>

- Provide rss and atom feeds for the blog ([#2562](https://github.com/npmx-dev/npmx.dev/pull/2562))

</details>

## Also

Besides all of that, we also fixed and improved a lot of smaller things:

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
- Chunk OSV batch queries and follow pagination tokens ([#3470](https://github.com/npmx-dev/npmx.dev/pull/3470))
- **i18n:** Update Czech translations ([#3399](https://github.com/npmx-dev/npmx.dev/pull/3399))

## The people

A lot of what you just read landed during one weekend at the end of October, when [Felix](https://bsky.app/profile/felixs.dev) and [Roman](https://bsky.app/profile/rman.dev) spontaneously turned it into a little npmx hackathon: more than 20 PRs merged in two days, 12 of them from community contributors, and a much tidier issue tracker afterwards. None of it was planned, it just kinda happened, and we might do it more often 🙌

<BlueskyPostEmbed
  url="https://bsky.app/profile/felixs.dev/post/3mzbkh3usuk2h"
  uri="at://did:plc:pbjvqaziagcyv2vqodldn5op/app.bsky.feed.post/3mzbkh3usuk2h"
/>

Behind every merged PR, there is also someone who reviewed it, so a big thank you to everyone who took the time to read and test other people's code 🤝

## In our own voice

We also care a lot about how we talk to each other in PRs, which is why npmx follows the "Human Voice" AI policy from [ai-policy.dev](https://ai-policy.dev/) that [James](https://bsky.app/profile/43081j.com) launched this autumn. Using AI tools is totally fine, but every contribution should reflect your own understanding and be written in your own voice. And it's really nice to see that several contributors openly mention where AI helped them 🙏

<BlueskyPostEmbed
  url="https://bsky.app/profile/43081j.com/post/3mzkq6f52y224"
  uri="at://did:plc:7kxnbhtvb5cltkh6gaolfodf/app.bsky.feed.post/3mzkq6f52y224"
/>

## Events

Since the last post, we got to meet many of you in person again. [Daniel](https://bsky.app/profile/danielroe.dev) gave a talk about open source and npmx at JSConf MX, and in Brighton, our stickers made their way to the async meetup and to FFConf the day after:

<BlueskyPostEmbed
  url="https://bsky.app/profile/willow.sh/post/3n26u6qmf7s2h"
  uri="at://did:plc:dfkjiu36xs6ogt7pux7i7o2b/app.bsky.feed.post/3n26u6qmf7s2h"
/>

And [Kevin Powell](https://bsky.app/profile/kevinpowell.co) chatted with Daniel about open source, and why it still matters to understand your code, even when agents write it:

<BlueskyPostEmbed
  url="https://bsky.app/profile/kevinpowell.co/post/3n2opetr4is22"
  uri="at://did:plc:xbj7qbl7qmoo7dpf5dheplex/app.bsky.feed.post/3n2opetr4is22"
  media-hint="video"
/>

## What's next

There's already a lot cooking for the next releases, for example, [Philippe](https://bsky.app/profile/philippeserhal.com) is experimenting with package collections built on ATproto. And who knows, maybe his Halloween noodle finally gets approved next year 🎃

<BlueskyPostEmbed
  url="https://bsky.app/profile/philippeserhal.com/post/3mz7novwqnk2g"
  uri="at://did:plc:5wdnwfs45bghuedlj3rdmani/app.bsky.feed.post/3mz7novwqnk2g"
  media-hint="video"
/>

## Join us

None of this would have been possible without all of you. 24 people wrote code for these three releases, 8 of them for the very first time, and so many more helped by reviewing, testing, reporting bugs, or just chatting with us at events. If something in npmx bugs you or you have an idea, come and build it with us. Maybe we'll celebrate your first contribution in the next post. Because in the end, npmx is about people 🩷

[Site](https://npmx.dev) • [Builders Discord](https://build.npmx.dev/) • [GitHub](https://repo.npmx.dev/) • [Bluesky](https://social.npmx.dev/)
