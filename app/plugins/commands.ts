export default defineNuxtPlugin(() => {
  const { register } = useCommandRegistry()
  register({
    id: 'npmx:hello',
    name: 'Hello',
    description: 'Say hello to npmx',
    handler: async () => {
      console.log('Hello npmx!')
    },
  })
})
