import { icons as lucideIcons } from '@iconify-json/lucide'
import { icons as svgSpinners } from '@iconify-json/svg-spinners'
import customIcons from '../assets/media/custom-icons.json'

// NOTE: these have been left commented to prevent startup crashes due to the number of classes loaded
// import { icons as simpleIcons } from '@iconify-json/simple-icons'
// import { icons as vscodeIcons } from '@iconify-json/vscode-icons'
// const simpleClasses = Object.keys(simpleIcons.icons).map(name => `i-simple-icons:${name}`)
// const vscodeClasses = Object.keys(vscodeIcons.icons).map(name => `i-vscode-icons:${name}`)

const lucideClasses = Object.keys(lucideIcons.icons)
  .concat(Object.keys(lucideIcons.aliases!))
  .map(name => `i-lucide:${name}`)
const svgSpinnerClasses = Object.keys(svgSpinners.icons).map(name => `i-svg-spinners:${name}`)
const customClasses = Object.keys(customIcons).map(name => `i-custom:${name}`)

const safelist = [...lucideClasses, ...svgSpinnerClasses, ...customClasses]
export default safelist
