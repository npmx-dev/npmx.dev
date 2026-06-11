---
authors:
  - name: Alex Savelyev
    blueskyHandle: alexdln.com
  - name: Willow (GHOST)
    blueskyHandle: willow.sh
  - name: James
    blueskyHandle: 43081j.com
  - name: Alec Lloyd Probert
    blueskyHandle: graphieros.npmx.social
title: 'npmx crystal chronicle'
tags: ['OpenSource', 'Release']
excerpt: 'npmx 0.11 is out! This past month, npmx continued improving towards a beta milestone, focusing on performance, accessibility, and stability'
date: '2026-05-13'
slug: 'release/crystal-chronicle'
image: 'https://npmx.dev/blog/og/release-crystal-chronicle.png'
description: 'npmx 0.11 is out! This past month, npmx continued improving towards a beta milestone, focusing on performance, accessibility, and stability'
draft: false
---

# npmx 0.11 crystal chronicle

Hard to believe we started [npmx](https://npmx.dev) 100 days ago, and now more than 100K monthly visitors are using the tool. By GitHub contributors, we’re [the fastest-growing emerging open source organization](https://osscar.dev). It seems like a good moment for another release. We’re happy to share that npmx 0.11 is out! For many of us, it feels as though both the product and the community building it have always been there. But a few months ago, the idea of a new browser for [npmjs.com](https://npmjs.com/) wasn’t even on the table. This past month, npmx continued improving towards a beta milestone, focusing on performance, accessibility, and stability. But the number of new features added in npmx [0.9](https://github.com/npmx-dev/npmx.dev/releases/tag/v0.9.0), [0.10](https://github.com/npmx-dev/npmx.dev/releases/tag/v0.10.0), and [0.11](https://github.com/npmx-dev/npmx.dev/releases/tag/v0.11.0) isn’t slowing down. We’ll walk through them in the post.

Over the past months, we all felt empowered by seeing npmx take off and the reaction from the ecosystem. It makes a huge difference in our lives as maintainers to use tools we can fix and extend. We have a new shared commons where we can share ideas and implement features to improve how we work. Not only for ourselves, but for everyone else, too.

![npmx alpha](/blog/og/release-crystal-chronicle.png)

We had many conversations, encouraged by npmx’s success, about what else we could do for the web. Some of these ideas are shaping into new sister projects, explorations that may eventually return as npmx features. It’s a great time to get involved. Let’s keep building together.

## What’s new?

To keep a high-quality and predictable user experience, we’ve switched to planned [milestone releases](https://github.com/orgs/npmx-dev/projects/1). Each milestone includes several [releases or hotfixes](https://github.com/npmx-dev/npmx.dev/releases), and each release is assembled separately. When a milestone is completed, we’ll share in our [blog](https://npmx.dev/blog) the most important changes in the project and the community.

### Timeline tab

When it comes to growth, one of the most important metrics is change rather than absolute values. It shows how the project or package is evolving and in what direction. To make this analysis easier, we added a Timeline tab that shows not only versions, but also the key changes that happened in each of them.

<BlueskyPostEmbed url="https://bsky.app/profile/graphieros.npmx.social/post/3mllmom2zfk2v" />

### Module replacements v3

Another important part of npmx collaborations is our connection with the [e18e community](https://e18e.dev) . Thanks to this close relationship, you will see more detailed suggestions to optimize your dependencies as we switched to the new version of module replacements. They also now let you browse them all independently at [replacements.fyi](https://replacements.fyi/)

<BlueskyPostEmbed url="https://bsky.app/profile/43081j.com/post/3mkietfufb22f" />

### Celebrate size decreases

We talk a lot about how to make your applications faster and more secure by showing deprecated dependencies, size growth, suitable replacements, and so on. But we’ve overlooked one of the most important and enjoyable optimizations: reducing package size. This is a huge amount of work that authors do, and we’re happy to now showcase it on the packages page

<BlueskyPostEmbed url="https://bsky.app/profile/jviide.iki.fi/post/3ml6xwt2puc2y" />

### Prefill pm from query param

We’re building the service so that everyone’s experience is as good as possible. This wouldn’t be possible without the tools that make both npmx and the entire ecosystem better.

To make the ecosystem experience more convenient, you can now add the package manager to the URL. This allows projects to specify in their links which package manager should be the default.

[https://npmx.dev/package/nuxt?pm=pnpm](https://npmx.dev/package/nuxt?pm=pnpm)

And now, for example, when you follow links from pnpm, you’ll immediately get the expected commands for quick copying and getting started with the package.

<BlueskyPostEmbed url="https://bsky.app/profile/pnpm.io/post/3mjhihoyjwc2w" />

### Scatter with selectable axis

The community has always been a key part of npmx. And we’re incredibly excited to work together to create the perfect experience. In the last release, we added a package comparison chart with the scoring system. This chart, given the specific nature of any comparison, received a lot of feedback from the community. To make the experience more comprehensive and convenient, we’ve made it so you can now choose what and how you want to compare.

<BlueskyPostEmbed url="https://bsky.app/profile/graphieros.npmx.social/post/3mjzlmesrts2f" />

### And much more

- Add timeline tab to package page ([#2245](https://github.com/npmx-dev/npmx.dev/pull/2245))
- New og images ([#2292](https://github.com/npmx-dev/npmx.dev/pull/2292))
- Module replacements v3 ([#2068](https://github.com/npmx-dev/npmx.dev/pull/2068))
- Celebrate size decreases ([#2620](https://github.com/npmx-dev/npmx.dev/pull/2620))
- **ui:** Support Vite+ `vp` package manager commands ([#2451](https://github.com/npmx-dev/npmx.dev/pull/2451))
- Add `socket.dev` link into package command palette ([#2481](https://github.com/npmx-dev/npmx.dev/pull/2481))
- Replace quadrant with scatter with selectable axes ([#2472](https://github.com/npmx-dev/npmx.dev/pull/2472))
- Prefill package manager from query param ([#2520](https://github.com/npmx-dev/npmx.dev/pull/2520))
- add timeline chars ([#2663](https://github.com/npmx-dev/npmx.dev/pull/2663))
- Show badge on top liked packages, link to leaderboard ([#2459](https://github.com/npmx-dev/npmx.dev/pull/2459))

## State of npmx

Speaking about the development of npmx, we can’t skip plans and the future. And to bring a number of major ideas closer, we met in Edinburgh. Because even though you like building ideas together, sometimes you need to sit across from each other and throw out lots of ideas and problems related to the product. We discussed projects, lexicons, ideas, tasks, and much more, and simply had a great time.

![A collage of photos of the team during meetings in Edinburgh](/blog/team-edinburgh.jpg)

We spoke about organising in-person meetups, to share ideas over pizza and drinks. We actually did a social before CityJS London in April, it was great fun to get together as a community, even if it was only a few of us due to the very last minute organising. If all goes well, we may have meetups in London, Berlin, and Paris in the next months. Join the community if you'd like to participate, help or organise other events.

<BlueskyPostEmbed url="https://bsky.app/profile/willow.sh/post/3mjmelcxnas2m" />

Of course, we didn’t forget to have some noodles (_lots of noodles_)

[Alex](https://bsky.app/profile/alexdln.com) and [Alfon](https://bsky.app/profile/alfon.dev) worked on a new noodle for the [Press Freedom Day](https://en.wikipedia.org/wiki/World_Press_Freedom_Day). Our noodles calendar is starting to slowly fill with dates to commemorate. Get involved if you’d like to see more noodles in npmx.

<BlueskyPostEmbed url="https://bsky.app/profile/npmx.dev/post/3mkxoxckda22r" />

We’re also continuing to work on the community atmosphere in our discord. We’ve now launched a pack of our own emoji and additional stickers.

<BlueskyPostEmbed url="https://bsky.app/profile/alfon.dev/post/3mk6ff36etc2l" />

## We need your help

We continue to not only improve our registry browsing experience but also add completely new functionality to our everyday experience. And none of this would be possible without community. And if you want to help us improve the experience of developers, join us:

[Site](https://npmx.dev/) • [Builders Discord](https://build.npmx.dev/) • [GitHub](https://repo.npmx.dev/) • [Bluesky](https://social.npmx.dev/)
