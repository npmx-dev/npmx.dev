import LogoNuxt from '~/assets/logos/oss-partners/nuxt.svg'
import LogoOpenSourcePledge from '~/assets/logos/oss-partners/open-source-pledge.svg'
import LogoOpenSourcePledgeLight from '~/assets/logos/oss-partners/open-source-pledge-light.svg'
import LogoOxC from '~/assets/logos/oss-partners/oxc.svg'
import LogoRolldown from '~/assets/logos/oss-partners/rolldown.svg'
import LogoStorybook from '~/assets/logos/oss-partners/storybook.svg'
import LogoVite from '~/assets/logos/oss-partners/vite.svg'
import LogoVitest from '~/assets/logos/oss-partners/vitest.svg'
import LogoVue from '~/assets/logos/oss-partners/vue.svg'
import LogoAlgolia from '~/assets/logos/oss-partners/algolia.svg'
import LogoAlgoliaLight from '~/assets/logos/oss-partners/algolia-light.svg'
import LogoAtmosphereConf from './atmosphereconf.png'
import LogoAtmosphereConfLight from './atmosphereconf-light.png'
import LogoE18e from './e18e.svg'
import LogoShiki from './shiki.svg'
import LogoUnoCss from './unocss.svg'
import LogoVitePwa from './vite-pwa.svg'
import LogoVitePwaLight from './vite-pwa-light.svg'
import LogoVueUse from './vueuse.svg'
import LogoVueDataUi from './vue-data-ui.png'
import LogoUnJs from './unjs.svg'
import LogoH3 from './h3.svg'
import LogoNitro from './nitro.svg'
import LogoKnip from './knip.svg'
import LogoAtcute from './atcute.png'
import LogoNapiRs from './napi-rs.png'
import LogoValibot from './valibot.svg'
import LogoFastCheck from './fast-check.svg'
import LogoLunaria from './lunaria.svg'
import LogoJsr from './jsr.svg'
import LogoIconify from './iconify.svg'
import LogoFloatingUi from './floating-ui-vue.svg'

// The list is used on the about page. To add, simply upload the logos nearby and add an entry here. Prefer SVGs.
// For logo src, specify a string or object with the light and dark theme variants.
// Prefer original assets from partner sites to keep their brand identity.
//
// If there are no original assets and the logo is not universal, you can add only the dark theme variant
// and specify 'auto' for the light one - this will grayscale the logo and invert it in light mode.
export const OSS_PARTNERS = [
  {
    name: 'Open Source Pledge',
    logo: {
      dark: LogoOpenSourcePledge,
      light: LogoOpenSourcePledgeLight,
    },
    url: 'https://opensourcepledge.com/',
  },
  {
    name: 'Void Zero',
    items: [
      {
        name: 'Vite',
        logo: LogoVite,
        url: 'https://vite.dev/',
      },
      {
        name: 'OxC',
        logo: LogoOxC,
        url: 'https://oxc.rs/',
      },
      {
        name: 'Vitest',
        logo: LogoVitest,
        url: 'https://vitest.dev/',
      },
      {
        name: 'Rolldown',
        logo: LogoRolldown,
        url: 'https://rolldown.rs/',
      },
    ],
  },
  {
    name: 'Nuxt',
    logo: LogoNuxt,
    url: 'https://nuxt.com/',
  },
  {
    name: 'Vue',
    logo: LogoVue,
    url: 'https://vuejs.org/',
  },
  {
    name: 'Algolia',
    logo: {
      dark: LogoAlgolia,
      light: LogoAlgoliaLight,
    },
    url: 'https://algolia.com/',
  },
  {
    name: 'Storybook',
    logo: LogoStorybook,
    url: 'https://storybook.js.org/',
  },
  {
    name: 'ATmosphereConf',
    logo: {
      dark: LogoAtmosphereConf,
      light: LogoAtmosphereConfLight,
    },
    url: 'https://atmosphereconf.org/',
  },
  {
    name: 'e18e',
    logo: LogoE18e,
    url: 'https://e18e.dev/',
  },
  {
    name: 'Shiki',
    logo: LogoShiki,
    url: 'https://shiki.style/',
  },
  {
    name: 'UnoCSS',
    logo: LogoUnoCss,
    url: 'https://unocss.dev/',
  },
  {
    name: 'Vite PWA',
    logo: {
      dark: LogoVitePwa,
      light: LogoVitePwaLight,
    },
    url: 'https://vite-pwa-org.netlify.app/',
  },
  {
    name: 'Vue Use',
    logo: LogoVueUse,
    url: 'https://vueuse.org/',
  },
  {
    name: 'Vue Data UI',
    logo: LogoVueDataUi,
    url: 'https://vue-data-ui.graphieros.com/',
  },
  {
    name: 'UnJS',
    logo: LogoUnJs,
    url: 'https://unjs.io/',
  },
  {
    name: 'H3',
    logo: LogoH3,
    url: 'https://h3.dev/',
  },
  {
    name: 'Nitro',
    logo: LogoNitro,
    url: 'https://nitro.build/',
  },
  {
    name: 'Knip',
    logo: LogoKnip,
    url: 'https://knip.dev/',
  },
  {
    name: 'atcute',
    logo: LogoAtcute,
    url: 'https://tangled.org/mary.my.id/atcute',
  },
  {
    name: 'Napi RS',
    logo: LogoNapiRs,
    url: 'https://napi.rs/',
  },
  {
    name: 'Valibot',
    logo: LogoValibot,
    url: 'https://valibot.dev/',
  },
  {
    name: 'Fast Check',
    logo: LogoFastCheck,
    url: 'https://fast-check.dev/',
  },
  {
    name: 'Lunaria',
    logo: LogoLunaria,
    url: 'https://lunaria.dev/',
  },
  {
    name: 'JSR',
    logo: LogoJsr,
    url: 'https://jsr.io/',
  },
  {
    name: 'Iconify',
    logo: LogoIconify,
    url: 'https://iconify.design/',
  },
  {
    name: 'Floating UI',
    logo: LogoFloatingUi,
    url: 'https://floating-ui.com/',
  },
]
