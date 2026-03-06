import { create } from 'storybook/theming/create'

const npmxDark = create({
  base: 'dark',

  brandTitle: 'npmx Storybook',
  brandImage: '/npmx-storybook.svg',

  // UI
  appContentBg: '#101010', // oklch(0.171 0 0)
})

export default npmxDark
