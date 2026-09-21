import { Feed } from 'feed'
import { posts } from '#blog/posts'

const makeUrlAbsolute = (url: string) => new URL(url, 'https://npmx.dev').toString()

export function getFeed() {
  // Generate content for RSS and Atom
  const feed = new Feed({
    title: 'Blog - npmx',
    description: 'A fast, modern browser for the npm registry',
    id: 'https://npmx.dev/blog',
    link: 'https://npmx.dev/blog',
    language: 'en',
    image: 'https://npmx.dev/logo.svg',
    favicon: 'https://npmx.dev/favicon.ico',
    feedLinks: {
      rss: 'https://npmx.dev/blog/rss.xml',
      atom: 'https://npmx.dev/blog/atom.xml',
    },
  })

  for (const post of posts.filter(p => !p.draft)) {
    feed.addItem({
      title: post.title,
      id: makeUrlAbsolute(post.path),
      link: makeUrlAbsolute(post.path),
      description: post.description,
      author: post.authors.map(author => ({
        name: author.name,
        link: author.profileUrl ?? undefined,
        // author.avatar is a relative URL - make it absolute to work in feed readers
        avatar: author.avatar ? makeUrlAbsolute(author.avatar) : undefined,
      })),
      date: new Date(post.date),
      image: post.image ? makeUrlAbsolute(post.image) : undefined,
    })
  }

  return feed
}
