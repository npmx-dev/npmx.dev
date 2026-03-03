---
authors:
  - name: Daniel Roe
    blueskyHandle: danielroe.dev
  - name: Salma Alam-Naylor
    blueskyHandle: whitep4nth3r.com
  - name: Matias Capeletto
    blueskyHandle: patak.cat
title: 'Announcing npmx: a fast, modern browser for the npm registry'
tags: ['OpenSource', 'Release']
excerpt: "Today we're releasing the alpha of npmx.dev – a fast, modern browser for the npm registry, built in the open by a growing community."
date: '2026-03-03'
slug: 'alpha-release'
description: "Today we're releasing the alpha of npmx.dev – a fast, modern browser for the npm registry, built in the open by a growing community."
draft: false
---

# Announcing npmx: a fast, modern browser for the npm registry

Today we're releasing the alpha of [npmx.dev](https://npmx.dev), a fast, modern browser for the npm registry.

npmx is about speed and simplicity: making it quicker and easier to find, evaluate, and manage npm packages. It gives you useful data &ndash; like install size, module format, and outdated dependencies &ndash; right where you need it, so you can make better decisions about the packages you use.

We're also building social features into npmx because open source is better when it's easier to connect with the people behind the packages.

## The need for npmx

On January 22nd 2026, Daniel Roe, open-source maintainer and founder, and leader of the [Nuxt](https://nuxt.com/) core
team, had an idea, and made
[the first commit to the npmx repository](https://github.com/npmx-dev/npmx.dev/commit/e39e56c08fd1e7bdb556c8565c6b11b3c34c8934).
The next day, [Daniel posted on Bluesky](https://bsky.app/profile/danielroe.dev/post/3md3cmrg56k2r) asking
about people's frustrations with the npm experience &ndash; both on the web and in the CLI. The responses came flooding in:
code browsing, missing data, trust signals, dependency visibility, and the general friction around publishing.

<BlueskyPostEmbed url="https://bsky.app/profile/danielroe.dev/post/3md3cmrg56k2r" />

Clearly, there was an appetite for something better &ndash; and people were willing to help build it.

## The power of community

Things moved fast. Within 24 hours, 49 pull requests had been opened. Two weeks later, the
[community had contributed 1000 issues and PRs](https://github.com/npmx-dev/npmx.dev/issues/1000) &ndash; that's roughly
_one every 20 minutes_, around the clock. With
[over 105 contributors](https://github.com/npmx-dev/npmx.dev/graphs/contributors) and 1500 stars in just 16 days, npmx became one of the most active early open-source projects we've seen.

[![Star History Chart](https://api.star-history.com/svg?repos=npmx-dev/npmx.dev&type=date&legend=top-left)](https://www.star-history.com/#npmx-dev/npmx.dev&type=date&legend=top-left)

We don't think this happened by accident. From the start, npmx prioritized accessibility, internationalization, and working in the open. This attracted people who care about those things &ndash; and who are good at collaborating because of it. The result is a genuinely diverse, global community that's a joy to be part of.

## What you can do with npmx today

Search and view details about packages, users and organizations available on npm, and dive deeper into the code. Plus get detailed information on:

- download statistics
- outdated dependency warnings
- module format (ESM/CJS)
- install size
- [JSR](https://jsr.io/) cross-reference
- multi-provider repo support
- version range resolution
- package likes and social features
- performance recommendations powered by [e18e](https://e18e.dev/)

You can also launch [StackBlitz](https://stackblitz.com/), [CodeSandbox](https://codesandbox.io/), and other demo environments directly from package READMEs. Additionally, npmx is available in 19 languages, has light and dark mode, and is designed to be keyboard-friendly throughout.

## The future of npmx

We want to build a better package browsing and management experience for everyone in the JavaScript ecosystem. We're moving fast, but we don't have all the answers. Right now we're building for our peers: open-source developers who work with packages daily and are willing to try something early and tell us what's working and what isn't. That feedback is how we'll get to beta.

## Join us at npmx

We'd love for you to get involved. Even if you've never contributed to open source before &ndash; you are welcome. If you're not sure where to start, Salma Alam-Naylor has written
[a ten-step guide to making your first open-source contribution on GitHub](https://whitep4nth3r.com/blog/how-to-make-your-first-open-source-contribution/).

Below this post, you'll also find articles from npmx contributors sharing their own perspectives and experiences.

This npmx alpha is intentionally early. We want real-world feedback from _you_ to guide what we work on next. Try [npmx](https://npmx.dev) today, tell us what you think at [chat.npmx.dev](https://chat.npmx.dev), [open an issue on GitHub](https://github.com/npmx-dev/npmx.dev/issues), or submit a pull request. And [follow npmx.dev on Bluesky](https://bsky.app/profile/npmx.dev) to keep up with what we're building.

Thank you to everyone who has contributed so far &ndash; code, docs, testing, community, and more. You're the ones building this.

---

<BlogPostFederatedArticles
headline="Read more from the community"
:articles="[
  {
    url: 'https://whitep4nth3r.com/blog/how-to-make-your-first-open-source-contribution/',
    title: 'How to Make Your First Open Source Contribution',
    authorHandle: 'whitep4nth3r.com',
    description: 'Getting involved in open source doesn\'t have to be scary! Understand how to find a great project and make your first contribution in this guide from Salma.'
  },
  {
    url: 'https://roe.dev/blog/a-virtuous-cycle',
    title: 'A Virtuous Circle',
    authorHandle: 'danielroe.dev',
    description: 'There\'s a reason why building npmx has been such a blast so far, and it\'s one of the most powerful patterns in open source software development. It\'s also why \'the 10x developer\' is an incredibly dangerous myth.'
  },
  {
    url: 'https://patak.cat/npmx/converging-communities',
    title: 'npmx: converging communities',
    authorHandle: 'patak.cat',
    description: 'The story of the many people and communities that converged to build npmx together.'
  },
  {
    url: 'https://graphieros.github.io/graphieros-blog/blog/2026/npmx.html',
    title: 'vue-data-ui is on npmx npmx is on vue-data-ui',
    authorHandle: 'graphieros.com',
    description: 'Graphieros explores a minimal npm-based workflow and why it exists.'
  },
  {
    url: 'https://www.alexdln.com/blog/npmx-the-month',
    title: 'The month. npmx',
    authorHandle: 'alexdln.com',
    description: 'Alex reflects on the project, warm stories, wonderful people, and a look into the future'
  },
  {
    url: 'https://www.netlify.com/blog/sponsoring-npmx',
    title: 'Sponsoring npmx',
    authorHandle: 'netlify.com',
    description: 'It’s more important than ever that companies come together across competitive boundaries to sponsor and support the open ecosystem that lifts all boats.',
  },
  {
    url: 'https://johnnyreilly.com/npmx-with-a-little-help-from-my-friends',
    title: 'npmx: With a Little Help From My Friends',
    authorHandle: 'johnnyreilly.com',
    description: 'How to contribute to npmx.dev, and thoughts on Johnny\'s experience with the project.'
  },
  {
    url: 'https://opensourcepledge.com/blog/npmx-a-lesson-in-open-source-collaboration-feedback-loops/',
    title: 'npmx: A Lesson in Open Source\'s Collaboration Feedback Loops',
    authorHandle: 'opensourcepledge.com',
    description: 'npmx\'s success is reminding us why Open Source is such a special social phenomenon.'
  },
  {
    url: 'https://blog.trueberryless.org/blog/npmx/',
    title: 'Rising community at tomorrow\'s horizon',
    authorHandle: 'trueberryless.org',
    description: 'Telling the story of a newly founded community.'
  },
  {
    url: 'https://conf.zurichjs.com/blog/open-source-needs-community',
    title: 'Open source needs community. Community needs open source.',
    authorHandle: 'zurichjs.com',
    description: 'Why ZurichJS cares about getting people into open source.',
  },
  {
    url: 'https://www.sybers.fr/blog/3mfhn5xoawz24',
    title: 'From a Bluesky post to my favorite open source community',
    authorHandle: 'sybers.fr',
    description: 'The best open source projects aren\'t just about great code. They\'re about the people behind them.'
  },
  {
    url: 'https://storybook.js.org/blog/storybook-npmx',
    title: 'Storybook 💙 npmx',
    authorHandle: 'storybook.js.org',
    description: 'We\'re huge fans of what the npmx community is building. Today\'s alpha is just the starting line, and we\'re proud to be running alongside them.'
  },
  {
    url: 'https://jensroemer.com/writing/open-source-whats-in-it-for-me/',
    title: 'Open source, what\'s in it for me?',
    authorHandle: 'jensroemer.com',
    description: 'Reflections on learning, community, and change.'
  },
  {
    url: 'https://voidzero.dev/posts/npmx-alpha',
    title: 'VoidZero and npmx: Building Better Tools Together',
    authorHandle: 'voidzero.dev',
    description: 'How VoidZero and npmx.dev share a vision for making JavaScript developers more productive, and how real-world feedback from open-source builders helps improve our tooling.',
  },
  {
    url: 'https://www.faziz-dev.com/blog/community-open-source-and-npmx',
    title: 'Community, Open Source, and npmx',
    authorHandle: 'farisaziz12.bsky.social',
    description: 'npmx isn’t just an npm browser, it\'s a fast-moving open source train that welcomes you aboard the moment you show up.',
  },
  {
    url: 'https://paulie.codes/blog/3mfs2stugzp2v',
    title: 'Overcoming Imposter Syndrome: My First Open Source Contribution',
    authorHandle: 'paulie.codes',
    description: 'The most important part of open source is the people, and everyone has something valuable to bring to the table.'
  },
  {
    url: 'https://philippeserhal.com/articles/oss-made-me-a-better-developer',
    title: 'OSS made me a better developer',
    authorHandle: 'philippeserhal.com',
    description: 'How getting involved in npmx made me a better developer.'
  },
  {
    url: 'https://news.atmosphereconf.org/3mg5b3zvktc2i',
    title: 'npmx goes social with atproto',
    authorHandle: 'atprotocol.dev',
    description: 'Announcing npmx speakers, and congratulations on launch day!'
  },
  {
    url: 'https://www.radosvet.dev/posts/career/from-newsletter-to-open-source',
    title: 'From a Newsletter Link to My First Open Source Contribution',
    authorHandle: 'radosvet.dev',
    description: 'How discovering npmx through a newsletter led to a first meaningful open source contribution and a new perspective on community-driven development.'
  },
  {
    url: 'https://vale.rocks/micros/20260303-1200',
    title: 'npmx Is Open-Source Done Right',
    authorHandle: 'vale.rocks',
    description: 'How the ethos and practices of npmx represent a healthy open-source ecosystem that should be the standard, not an exception.'
  },
  {
    url: 'https://e18e.dev/blog/npmx-collaboration.html',
    title: 'Collaborating with npmx',
    authorHandle: '43081j.com',
    description: 'How the e18e community is collaborating closely with npmx to make best practices more visible and accessible to everyone in the ecosystem.'
  },
  {
    url: 'https://youtu.be/NoC5U6F6p4Y',
    title: 'An open source and modern npmjs.com?! (Video)',
    authorHandle: 'thealexlichter.com',
    description: 'An introductory video that shows favorite features of NPMX and the open-source idea behind it.'
  }
]"
/>
