// NoiseXX browser wrapper (WASM) — facade with DevNoise fallback
// Attempts to load a WASM module that exposes a Noise XX responder.
// If the WASM module is not available, falls back to the existing DevNoise
// so the app keeps working while we add the real implementation.

type WasmNoise = {
  // Expected WASM exports (to be implemented by real module)
  // init(): Promise<void> (optional)
  create_responder: () => number; // returns a handle
  responder_read_message: (handle: number, in_ptr: number, in_len: number, out_ptr: number) => number;
  responder_write_message: (handle: number, out_ptr: number) => number;
  responder_encrypt: (handle: number, in_ptr: number, in_len: number, out_ptr: number) => number;
  responder_decrypt: (handle: number, in_ptr: number, in_len: number, out_ptr: number) => number;
  memory: WebAssembly.Memory;
};

export class NoiseXX {
  private wasm: WasmNoise | null = null;
  private handle: number | null = null;
  private devFallback: any | null = null;

  get usingFallback() { return !!this.devFallback; }

  async init() {
    try {
      // Attempt to load local WASM bundle (to be provided in build pipeline)
      const resp = await fetch('/noise_xx_bg.wasm');
      if (!resp.ok) throw new Error('wasm fetch failed');
      const { instance } = await WebAssembly.instantiateStreaming(resp, {});
      this.wasm = instance.exports as unknown as WasmNoise;
      // Initialize responder state
      this.handle = this.wasm.create_responder();
    } catch (e) {
      // Fallback to DevNoise while WASM is not present
      const { DevNoise } = await import('./devNoise');
      this.devFallback = new DevNoise();
    }
  }

  async startResponder(ws: WebSocket) {
    if (!this.wasm || this.handle == null) {
      // Fallback path
      if (!this.devFallback) await this.init();
      return this.devFallback!.handleInitAndRespond(ws);
    }
    // Real WASM responder handshake would go here (binary-only messages)
    // For now, let fallback handle it until WASM is wired fully.
    if (!this.devFallback) {
      const { DevNoise } = await import('./devNoise');
      this.devFallback = new DevNoise();
    }
    return this.devFallback!.handleInitAndRespond(ws);
  }

  async encryptJson(obj: any): Promise<ArrayBuffer> {
    if (!this.wasm || this.handle == null) {
      if (!this.devFallback) await this.init();
      return this.devFallback!.encryptJson(obj);
    }
    // TODO: route through wasm responder_encrypt once wired
    if (!this.devFallback) {
      const { DevNoise } = await import('./devNoise');
      this.devFallback = new DevNoise();
    }
    return this.devFallback!.encryptJson(obj);
  }

  async decryptFrame(buf: ArrayBuffer): Promise<any | null> {
    if (!this.wasm || this.handle == null) {
      if (!this.devFallback) await this.init();
      return this.devFallback!.decryptFrame(buf);
    }
    // TODO: route through wasm responder_decrypt once wired
    if (!this.devFallback) {
      const { DevNoise } = await import('./devNoise');
      this.devFallback = new DevNoise();
    }
    return this.devFallback!.decryptFrame(buf);
  }
}

