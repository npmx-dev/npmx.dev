---
authors:
  - name: Alex Savelyeva
    blueskyHandle: alexdln.com
  - name: Philippe Serhal
    blueskyHandle: philippeserhal.com
  - name: Alec Lloyd Probert
    blueskyHandle: graphieros.npmx.social
  - name: Willow (GHOST)
    blueskyHandle: willow.sh
title: 'npmx photon genesis'
tags: ['OpenSource', 'Release']
excerpt: 'More than 5 million visits a month, and npmx keeps getting faster. This release brings performance work down to every millisecond, more readable UI, smarter charts, and support for more tools and providers.'
date: '2026-10-29'
slug: 'release/photon-genesis'
image: 'https://npmx.dev/blog/og/release-photon-genesis.png'
description: 'More than 5 million visits a month, and npmx keeps getting faster. This release brings performance work down to every millisecond, more readable UI, smarter charts, and support for more tools and providers.'
draft: false
---

# npmx photon genesis

![npmx photon genesis](/blog/og/release-photon-genesis.png)

One of npmx’s greatest strengths is, of course, its people. First and foremost, the people who help us build and improve the experience day after day. But also those who talk with us and share their problems, observations, ideas, and experiences.

Although our last article came out more than three months ago, we’ve talked with you more than ever before. Thanks to you and your ideas, we’ve been able to make browsing even better for millions of users.

At the same time, behind every new feature is the team’s ongoing work to make the experience even more seamless and faster.

## Performance

Every month, we add dozens of new features, sections, and information blocks. And that number continues to grow. npmx’s traffic is growing too, with more than 5 million visits in the past month. Preserving that “fast and modern browsing” experience for every user - and making it even faster - remains our priority.

<BlueskyPostEmbed
  url="https://bsky.app/profile/philippeserhal.com/post/3mxmbc4xt2s2p"
  uri="at://did:plc:5wdnwfs45bghuedlj3rdmani/app.bsky.feed.post/3mxmbc4xt2s2p"
/>

We’re continually looking for ways to make npmx faster, down to every millisecond. Recent performance work includes:

- Checking trust downgrades only for the resolved version ([#3316](https://github.com/npmx-dev/npmx.dev/pull/3316))
- Loading install size and vulnerability data on demand ([#3315](https://github.com/npmx-dev/npmx.dev/pull/3315))
- Skipping source-map resolution in package documentation ([#3220](https://github.com/npmx-dev/npmx.dev/pull/3220))
- Avoiding a redundant packument fetch when checking for license changes ([#3322](https://github.com/npmx-dev/npmx.dev/pull/3322))
- Caching normalized, trimmed packuments instead of raw responses ([#3320](https://github.com/npmx-dev/npmx.dev/pull/3320))

![Time to First Byte percentiles in early October and late October: P99 dropped from 9.67s to 2.95s while traffic keep growing](/blog/ttfb-photon-genesis.png)

As a result, TTFB for the slowest requests improved more than threefold, so npmx stays responsive even on a slow connection. That said, a good experience is about more than speed - it’s also about making every part of the service convenient and accessible.

## UI/UX improvements

One of the most frequent requests was to improve the site’s readability. In previous releases, we’d already increased contrast and added the option to choose a background. That significantly improved the experience, but the site’s contrast still felt a little too muted for our taste. Now you can choose the level of text contrast you want, and it will apply to both text and interactive elements.

![The nuxt package page with the default and the highest foreground shade](/blog/contrast-photon-genesis.png)

<details>
<summary>PRs</summary>

- Increase text and interactive elems contrast ([#2621](https://github.com/npmx-dev/npmx.dev/pull/2621))

</details>

Another thing we’re actively thinking about is how to present the key content without unnecessary noise. We’re experimenting together and looking for ways to make the page more focused. One such improvement is a redesign of the install block.

![The vite package page before and after the install block redesign](/blog/install-block-photon-genesis.png)

<details>
<summary>PRs</summary>

- Install-block redesign and update ([#3262](https://github.com/npmx-dev/npmx.dev/pull/3262))

</details>

Of course, we also added new categories of information, such as provenance in the version history.

![Provenance icons in the nuxt version history](/blog/provenance-photon-genesis.png)

<details>
<summary>PRs</summary>

- Display provenance in version history ([#3253](https://github.com/npmx-dev/npmx.dev/pull/3253))

</details>

And the biggest improvement to the experience is undoubtedly the charts, which remain the quickest way to get information when researching packages.

## Charts improvements

In previous updates, we introduced the timeline - a section for exploring a package’s history across growth, security, and contents. Now you can also see changes in dependency size and deprecated versions there.

You can also filter the timeline by semver to compare only the versions and release channels you’re interested in. All those improvements make it easy to understand not only a package’s current state, but also its stability over time.

<BlueskyPostEmbed
  url="https://bsky.app/profile/philippeserhal.com/post/3murmv4eutc2a"
  uri="at://did:plc:5wdnwfs45bghuedlj3rdmani/app.bsky.feed.post/3murmv4eutc2a"
/>

<details>
<summary>PRs</summary>

- Add dependency size chart to timeline ([#2979](https://github.com/npmx-dev/npmx.dev/pull/2979))
- Add deprecated marking to package timeline page ([#3133](https://github.com/npmx-dev/npmx.dev/pull/3133))
- Show error icon on the timeline chart ([#3175](https://github.com/npmx-dev/npmx.dev/pull/3175))
- **ui:** Support sorting with semver in timeline ([#3192](https://github.com/npmx-dev/npmx.dev/pull/3192))

</details>

Alongside adding new information, we’re improving the charts themselves and how they look. For example, version distribution now uses a horizontal bar chart, making it easier to analyze packages with thousands of versions as well as with just two.

![The nuxt version distribution as a horizontal bar chart](/blog/version-distribution-photon-genesis.png)

Now, drag-to-zoom makes filtering charts faster, so you can get to the insights you need in fewer steps.

<details>
<summary>PRs</summary>

- Use a horizontal bar chart for the version distribution ([#3281](https://github.com/npmx-dev/npmx.dev/pull/3281))
- Drag-to-zoom on the trend charts & sparklines ([#3301](https://github.com/npmx-dev/npmx.dev/pull/3301))

</details>

In addition to directly improving the user experience, we’re looking for ways to make analysis better across a broader range of categories. One such improvement is adding support for more tools and services.

## Tools adoption

Tools continue to evolve and improve, focusing on different user needs and challenges. We’re glad to see them grow and develop, and we’re happy to give users the ability to work with their favorite tools.

To that end, nub, ni, and upm have been added as package managers for system package commands, helping make dependency installation more efficient.

<details>
<summary>PRs</summary>

- Add nub package manager support ([#3014](https://github.com/npmx-dev/npmx.dev/pull/3014))
- **ui:** Add ni package manager support ([#3187](https://github.com/npmx-dev/npmx.dev/pull/3187))
- **ui:** Add upm package manager support ([#3296](https://github.com/npmx-dev/npmx.dev/pull/3296))

</details>

And for analyzing package contents, we added support for new Git providers: Gitlab, Tangled, Codeberg, Forgejo, Pushin, Gitea, Bitbucket, SourceHut, and Gitee.

<details>
<summary>PRs</summary>

- Changelog - formatted links, more git providers & copy markdown ([#2983](https://github.com/npmx-dev/npmx.dev/pull/2983))
- Add support for Pushin (pushin.eu) as a git provider ([#3317](https://github.com/npmx-dev/npmx.dev/pull/3317))
- Changelog add support for gitea, bitbucket, sourcehut & gitee ([#3221](https://github.com/npmx-dev/npmx.dev/pull/3221))

</details>

<BlueskyPostEmbed
  url="https://bsky.app/profile/wilco.npmx.social/post/3mxp3t6dnvc2i"
  uri="at://did:plc:nlenimoh4wmif7s22hiw5uzt/app.bsky.feed.post/3mxp3t6dnvc2i"
/>

## Also

Perhaps one of the most important contributions from our wonderful community is helping keep the site accessible to everyone. One of the main ways to do that is by maintaining localization and adding support for more languages. Now you can use npmx in Korean, too.

<details>
<summary>PRs</summary>

- **i18n:** Add Korean (ko-KR) translations ([#3217](https://github.com/npmx-dev/npmx.dev/pull/3217))

</details>

Another way we can expand how we help users is by letting them scan their own projects. You can now upload your `package.json` to [npmx.dev](https://npmx.dev) and view detailed information about each project dependency. This tool is the first in the Tools section, and we’ll share more about the section in future releases.

![The dependencies of an uploaded package.json with details for gray-matter](/blog/tools-photon-genesis.png)

<details>
<summary>PRs</summary>

- Tools ([#3079](https://github.com/npmx-dev/npmx.dev/pull/3079))

</details>

We also fixed a number of issues and bugs on the site, including:

- Prioritize exact matches in Algolia search ([#3103](https://github.com/npmx-dev/npmx.dev/pull/3103))
- Outdated dependencies icon not shown ([#3099](https://github.com/npmx-dev/npmx.dev/pull/3099))
- Support shorthand git provider URLs ([#3068](https://github.com/npmx-dev/npmx.dev/pull/3068))
- Make hit areas of the charts zoom range handles more accessible ([#3199](https://github.com/npmx-dev/npmx.dev/pull/3199))

## Events

As mentioned earlier, we’ve met in person many times, and that’s what made this wonderful release happen. It seems we attended a record number of events. Thank you so much for taking the time to come and talk with us.

We attended a number of wonderful conferences. One of the latest was [ViteConf](https://viteconf.org/), where we shared how we work to create a great user and developer experience beyond direct metrics. You can find the talk on [YouTube](https://youtu.be/PfyIEgLzNYI?t=36158).

<BlueskyPostEmbed
  url="https://bsky.app/profile/voidzero.dev/post/3mxvqt4voxd2s"
  uri="at://did:plc:vqbogjyhzudzajc6bu6mxdni/app.bsky.feed.post/3mxvqt4voxd2s"
/>

At the same time, we were delighted to meet you at what felt like every conference we could attend, including [Local First Conf](https://www.localfirstconf.com/lfc2026), [ZurichJS](https://conf.zurichjs.com/), and [Web Engines Hackfest](https://webengineshackfest.org/).

<BlueskyPostEmbed
  url="https://bsky.app/profile/willow.sh/post/3mrx3nxdc3c2l"
  uri="at://did:plc:dfkjiu36xs6ogt7pux7i7o2b/app.bsky.feed.post/3mrx3nxdc3c2l"
/>

<BlueskyPostEmbed
  url="https://bsky.app/profile/farisaziz.com/post/3mvatorypak2z"
  uri="at://did:plc:wkjedkyoqg7b5zx26mrqx4jw/app.bsky.feed.post/3mvatorypak2z"
/>

<BlueskyPostEmbed
  url="https://bsky.app/profile/webengineshackfest.org/post/3mszlujvu622w"
  uri="at://did:plc:vc5a75uf2wkjg4svhkibzwi5/app.bsky.feed.post/3mszlujvu622w"
/>

We organized several meetups - in Amsterdam, Berlin, and Vienna.

<BlueskyPostEmbed
  url="https://bsky.app/profile/vladimir.berlin/post/3mw2mi7y3uk2r"
  uri="at://did:plc:x7cbjcbvndpjb3vyndsqgpsi/app.bsky.feed.post/3mw2mi7y3uk2r"
/>

<BlueskyPostEmbed
  url="https://bsky.app/profile/fubits.dev/post/3mpxvxvd46k2m"
  uri="at://did:plc:6aglx53tojyuwxwueap5og3h/app.bsky.feed.post/3mpxvxvd46k2m"
/>

<BlueskyPostEmbed
  url="https://bsky.app/profile/atproto.wien/post/3mrf4aqqs5s25"
  uri="at://did:plc:vao7qd2l2hy3tpolrqrkk4cj/app.bsky.feed.post/3mrf4aqqs5s25"
/>

And we even spoke on a podcast

<BlueskyPostEmbed
  url="https://bsky.app/profile/sustainoss.bsky.social/post/3mtlti6o2xl24"
  uri="at://did:plc:lphc6rjsm4rcnkyrmq4ix5sq/app.bsky.feed.post/3mtlti6o2xl24"
/>

## Noodles

Amid all this ongoing work to “cook” a better user experience, there was of course still room for our beloved noodles. The homepage transformed for:

### World Emoji Day

<BlueskyPostEmbed
  url="https://bsky.app/profile/patak.cat/post/3mqu4n4byok27"
  uri="at://did:plc:2gkh62xvzokhlf6li4ol3b3d/app.bsky.feed.post/3mqu4n4byok27"
  show-quoted-post
/>

### National GIF Day

<BlueskyPostEmbed
  url="https://bsky.app/profile/matteogabriele.npmx.social/post/3mur22llpgs2m"
  uri="at://did:plc:whydbshthutv6dtqdd3zlwf2/app.bsky.feed.post/3mur22llpgs2m"
/>

### Iojs and Nodejs Merge Date

<BlueskyPostEmbed
  url="https://bsky.app/profile/alexdln.com/post/3mvhombdfac22"
  uri="at://did:plc:er6erflnnxcozlbqmrpflt6h/app.bsky.feed.post/3mvhombdfac22"
/>

### Blender Open-source Date

<BlueskyPostEmbed
  url="https://bsky.app/profile/alexdln.com/post/3mxqgnxwj6c2r"
  uri="at://did:plc:er6erflnnxcozlbqmrpflt6h/app.bsky.feed.post/3mxqgnxwj6c2r"
  show-quoted-post
/>

<details>
<summary>PRs</summary>

- Add an interactive World Emoji Day noodle ([#3038](https://github.com/npmx-dev/npmx.dev/pull/3038))
- Add noodle for national gif day ([#3067](https://github.com/npmx-dev/npmx.dev/pull/3067))
- Iojs and nodejs merge noodle ([#3238](https://github.com/npmx-dev/npmx.dev/pull/3238))
- Add blender noodle ([#3314](https://github.com/npmx-dev/npmx.dev/pull/3314))

</details>

## Join us

As always, none of this would have been possible without you! Npmx isn’t just a service - it’s a community of more than 300 contributors working together to make our everyday experience better in all kinds of ways. Join us, and let’s bring ideas to life together.

<BlueskyPostEmbed
  url="https://bsky.app/profile/atinux.com/post/3mrwzn7mlg22u"
  uri="at://did:plc:qrygjljnajqwxbld3k7uvyms/app.bsky.feed.post/3mrwzn7mlg22u"
/>

[Site](https://npmx.dev) • [Builders Discord](https://build.npmx.dev/) • [GitHub](https://repo.npmx.dev/) • [Bluesky](https://social.npmx.dev/)

<BlueskyPostEmbed
  url="https://bsky.app/profile/willow.sh/post/3mvsewfbeec2g"
  uri="at://did:plc:dfkjiu36xs6ogt7pux7i7o2b/app.bsky.feed.post/3mvsewfbeec2g"
/>
