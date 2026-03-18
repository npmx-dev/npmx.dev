export const SELECT_SIZES = {
  none: '',
  sm: 'text-xs px-2 py-1.75 rounded-md',
  md: 'text-sm px-3 py-2.25 rounded-lg',
  lg: 'text-base px-6 py-4 rounded-xl',
}

export type SelectBaseProps = {
  disabled?: boolean
  size?: keyof typeof SELECT_SIZES
}
