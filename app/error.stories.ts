import Error from './error.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { NuxtError } from '#app'

const meta = {
  title: 'pages/error',
  component: Error,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Error>

export default meta
type Story = StoryObj<typeof meta>

/** Package, org, or page not found. */
export const NotFound: Story = {
  args: {
    error: {
      status: 404,
    } as NuxtError,
  },
}

/** Unauthorized access - shown when authentication is required. */
export const Unauthorized: Story = {
  args: {
    error: {
      status: 401,
    } as NuxtError,
  },
}

/** Generic server error with default message. */
export const ServerError: Story = {
  args: {
    error: {
      status: 500,
    } as NuxtError,
  },
}

/** Service unavailable - occurs when external services (jsDelivr, npm registry) fail. */
export const ServiceUnavailable: Story = {
  args: {
    error: {
      status: 503,
    } as NuxtError,
  },
}

export const Teapot: Story = {
  args: {
    error: {
      status: 418,
    } as NuxtError,
  },
}

/** Error with a message. */
export const WithMessage: Story = {
  args: {
    error: {
      status: 404,
      message: 'The page you are looking for does not exist.',
    } as NuxtError,
  },
}

/** Error with a detailed message to test text wrapping and layout. */
export const LongMessage: Story = {
  args: {
    error: {
      status: 500,
      message:
        'Internal server error. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean tristique ex ac nisi dapibus maximus. Curabitur feugiat lorem eros, sed eleifend purus facilisis at.',
    } as NuxtError,
  },
}
