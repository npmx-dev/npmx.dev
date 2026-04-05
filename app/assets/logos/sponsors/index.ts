import LogoVercel from './vercel.svg'
import LogoVercelLight from './vercel-light.svg'
import LogoVoidZero from './void-zero.svg'
import LogoVoidZeroLight from './void-zero-light.svg'
import LogoVlt from './vlt.svg'
import LogoVltLight from './vlt-light.svg'
import LogoNetlify from './netlify.svg'
import LogoNetlifyLight from './netlify-light.svg'
import LogoBluesky from './bluesky.svg'
import LogoBlueskyLight from './bluesky-light.svg'
import LogoBadrap from './badrap.svg'
import LogoBadrapLight from './badrap-light.svg'
import LogoChromatic from './chromatic.svg'
import LogoChromaticLight from './chromatic-light.svg'

// The list is used on the about page. To add, simply upload the logos nearby and add an entry here. Prefer SVGs.
// For logo src, specify a string or object with the light and dark theme variants.
// Prefer original assets from partner sites to keep their brand identity.
//
// If there are no original assets and the logo is not universal, you can add only the dark theme variant
// and specify 'auto' for the light one - this will grayscale the logo and invert it in light mode.
// The normalisingIndent is the Y-axis space to visually stabilize favicon-only logos with logotypes that contain long name.
export const SPONSORS = [
  {
    name: 'Vercel',
    logo: {
      dark: LogoVercel,
      light: LogoVercelLight,
    },
    normalisingIndent: '0.875rem',
    url: 'https://vercel.com/',
  },
  {
    name: 'Void Zero',
    logo: {
      dark: LogoVoidZero,
      light: LogoVoidZeroLight,
    },
    normalisingIndent: '0.875rem',
    url: 'https://voidzero.dev/',
  },
  {
    name: 'vlt',
    logo: {
      dark: LogoVlt,
      light: LogoVltLight,
    },
    normalisingIndent: '0.875rem',
    url: 'https://vlt.sh/',
  },
  {
    name: 'Netlify',
    logo: {
      dark: LogoNetlify,
      light: LogoNetlifyLight,
    },
    normalisingIndent: '0.125rem',
    url: 'https://netlify.com/',
  },
  {
    name: 'Bluesky',
    logo: {
      dark: LogoBluesky,
      light: LogoBlueskyLight,
    },
    normalisingIndent: '0.625rem',
    url: 'https://bsky.app/',
  },
  {
    name: 'Chromatic',
    logo: {
      dark: LogoChromatic,
      light: LogoChromaticLight,
    },
    normalisingIndent: '0.5rem',
    url: 'https://chromatic.com/',
  },
  {
    name: 'Badrap',
    logo: {
      dark: LogoBadrap,
      light: LogoBadrapLight,
    },
    normalisingIndent: '0.5rem',
    url: 'https://badrap.io/',
  },
]
