export type ProcessMode = 'server' | 'worker';

export type ProcessModeGetter = () => ProcessMode;
export type ProcessModeSpecifier = ProcessMode | ProcessModeGetter;

let globalProcessMode: ProcessModeGetter;

export class ProcessContext {
  private readonly getMode?: ProcessModeGetter;

  constructor(mode?: ProcessModeSpecifier) {
    if (mode) {
      this.getMode = typeof mode === 'function' ? mode : () => mode;
    }
  }

  get mode(): ProcessMode {
    return this.getMode?.() ?? globalProcessMode?.() ?? 'server';
  }

  get isServer(): boolean {
    return this.mode === 'server';
  }

  get isWorker(): boolean {
    return this.mode === 'worker';
  }

  static setProcessMode(mode: ProcessModeSpecifier): void {
    globalProcessMode = typeof mode === 'function' ? mode : () => mode;
  }
}
