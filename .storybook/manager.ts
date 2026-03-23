import { addons } from 'storybook/manager-api'
import npmxDark from './theme'

addons.setConfig({
  theme: npmxDark,
  layoutCustomisations: {
    showToolbar: (state, defaultValue) => {
      if (state.viewMode === 'docs' && state.storyId) {
        const story = state.index?.[state.storyId]
        const tags = story?.tags || []
        if (tags.includes('hide-toolbar')) {
          return false
        }
      }
      return defaultValue
    },
  },
})
