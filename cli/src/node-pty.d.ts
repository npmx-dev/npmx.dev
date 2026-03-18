// @lydell/node-pty package.json does not export its types so for nodenext target we need to add them
declare module '@lydell/node-pty' {
  export function spawn(
    file: string,
    args: string[] | string,
    options: IPtyForkOptions | IWindowsPtyForkOptions,
  ): IPty
  export interface IBasePtyForkOptions {
    name?: string
    cols?: number
    rows?: number
    cwd?: string
    env?: { [key: string]: string | undefined }
    encoding?: string | null
    handleFlowControl?: boolean
    flowControlPause?: string
    flowControlResume?: string
  }

  export interface IPtyForkOptions extends IBasePtyForkOptions {
    uid?: number
    gid?: number
  }

  export interface IWindowsPtyForkOptions extends IBasePtyForkOptions {
    useConpty?: boolean
    useConptyDll?: boolean
    conptyInheritCursor?: boolean
  }

  export interface IPty {
    readonly pid: number
    readonly cols: number
    readonly rows: number
    readonly process: string
    handleFlowControl: boolean
    readonly onData: IEvent<string>
    readonly onExit: IEvent<{ exitCode: number; signal?: number }>
    resize(columns: number, rows: number): void
    clear(): void
    write(data: string | Buffer): void
    kill(signal?: string): void
    pause(): void
    resume(): void
  }

  export interface IDisposable {
    dispose(): void
  }
  export interface IEvent<T> {
    (listener: (e: T) => any): IDisposable
  }
}
