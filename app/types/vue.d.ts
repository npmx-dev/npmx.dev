import type { HTMLAttributes, VNode } from 'vue'

declare module 'vue' {
  interface DialogHTMLAttributes {
    closedby?: 'any' | 'closerequest' | 'none'
  }

  interface GlobalComponents {
    search: (props: HTMLAttributes) => VNode
  }
}
