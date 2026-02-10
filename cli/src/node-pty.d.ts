// @lydell/node-pty package.json does not export its types so for nodenext target we need to add them
declare module '@lydell/node-pty' {
  interface IDisposable {
    dispose(): void
  }

  interface IEvent<T> {
    (listener: (e: T) => any): IDisposable
  }

  interface IPty {
    readonly pid: number
    readonly onData: IEvent<string>
    readonly onExit: IEvent<{ exitCode: number; signal?: number }>
    write(data: string | Buffer): void
    kill(signal?: string): void
  }

  export function spawn(
    file: string,
    args: string[] | string,
    options: {
      name?: string
      cols?: number
      rows?: number
      env?: Record<string, string | undefined>
    },
  ): IPty
}
