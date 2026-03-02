import { addons } from 'storybook/manager-api'
import { create } from 'storybook/theming'

const npmxTheme = create({
  brandTitle: 'npmx Storybook',
  brandImage: '/npmx-storybook.svg',
})

addons.setConfig({
  theme: npmxTheme,
})
