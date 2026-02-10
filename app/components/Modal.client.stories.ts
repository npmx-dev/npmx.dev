import type { Meta, StoryObj } from '@nuxtjs/storybook'
import { ref } from 'vue'
import Modal from './Modal.client.vue'
import ButtonBase from './Button/Base.vue'
import { userEvent } from 'storybook/test'

const meta = {
  component: Modal,
} satisfies Meta<typeof Modal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    modalTitle: 'Hello world 👋',
  },
  render: args => ({
    components: { Modal, ButtonBase },
    setup() {
      const modalRef = ref()
      const openModal = () => {
        modalRef.value?.showModal()
      }
      return { args, modalRef, openModal }
    },
    template: `
      <div>
        <ButtonBase @click="openModal" variant="primary">
          Open Modal
        </ButtonBase>
        
        <Modal ref="modalRef" v-bind="args">
          <p>This is the modal content.</p>
          <p>
            Click the X button or press ESC to close the modal.
          </p>
        </Modal>
      </div>
    `,
  }),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open Modal' }))
  },
}
