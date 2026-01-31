import { computed } from 'vue'

export interface Command {
  id: string
  name: string
  description: string | undefined
  handler?: (ctx: CommandContext) => Promise<void>
}

export interface CommandContext {
  input: (options: CommandInputOptions) => Promise<string | undefined>
  select: <T>(options: CommandSelectOptions<T>) => Promise<T | undefined>
}

export interface CommandInputOptions {
  prompt: string
}

export interface CommandSelectOptions<T> {
  prompt: string
  items: T[]
}

/**
 * Composable for global command registry.
 * @public
 */
export const useCommandRegistry = () => {
  const commands = useState<Map<string, Command>>('commands', () => new Map())

  const register = (command: Command) => {
    const serverCommand = {
      ...command,
      handler: undefined,
    }
    if (import.meta.server) {
      commands.value.set(command.id, serverCommand)
    } else {
      commands.value.set(command.id, command)
    }
    return () => {
      commands.value.delete(command.id)
    }
  }

  return {
    register,
    commands: computed(() => Array.from(commands.value.values())),
  }
}

/**
 * Registers a global command.
 * @public
 */
export const registerGlobalCommand = (command: Command) => {
  const { register } = useCommandRegistry()
  return register(command)
}

/**
 * Registers a command bound to the current component's lifecycle.
 *
 * The command is automatically unregistered when the component unmounts.
 * Use this to register commands that rely on local component state (context)
 * via closure capture.
 *
 * @public
 */
export const registerScopedCommand = (command: Command) => {
  const { register } = useCommandRegistry()
  let unregister: () => void

  onMounted(() => {
    unregister = register(command)
  })

  onUnmounted(() => {
    unregister()
  })
}
