import { icons as lucideIcons } from '@iconify-json/lucide'
// import { icons as simpleIcons } from '@iconify-json/simple-icons'
import { icons as svgSpinners } from '@iconify-json/svg-spinners'
// import { icons as vscodeIcons } from '@iconify-json/vscode-icons'
import customIcons from '../assets/media/custom-icons.json'

const lucideClasses = Object.keys(lucideIcons.icons)
  .concat(Object.keys(lucideIcons.aliases))
  .map(name => `i-lucide:${name}`)
// const simpleClasses = Object.keys(simpleIcons.icons).map(name => `i-simple-icons:${name}`)
const svgSpinnerClasses = Object.keys(svgSpinners.icons).map(name => `i-svg-spinners:${name}`)
// const vscodeClasses = Object.keys(vscodeIcons.icons).map(name => `i-vscode-icons:${name}`)
const customClasses = Object.keys(customIcons).map(name => `i-custom:${name}`)

const safelist = [
  ...lucideClasses,
  // ...simpleClasses,
  ...svgSpinnerClasses,
  // ...vscodeClasses,
  ...customClasses,
]

export default safelist
