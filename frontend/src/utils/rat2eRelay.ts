// Minimal RAT2E Relay client for Browser UI (spec v1 start)
// Opens WSS to relay with single subprotocol token:
//   "acp.jsonrpc.v1.stksha256.<BASE64URL>"

export type RelayEvents = {
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;
  onCiphertext?: (data: ArrayBuffer) => void;
  onJson?: (obj: any) => void;
};

export class Rat2eRelayClient {
  private ws: WebSocket | null = null;
  private noise: any | null = null;

  connect(opts: {
    relayWsUrl: string; // e.g. wss://relay.example.com/v1/connect
    sessionId: string;
    stkSha256B64u: string; // attach token hash (base64url)
    events?: RelayEvents;
  }) {
    const { relayWsUrl, sessionId, stkSha256B64u, events } = opts;
    // Append session_id query and pass single subprotocol token as per spec
    const url = `${relayWsUrl}?session_id=${encodeURIComponent(sessionId)}`;
    const protocol = `acp.jsonrpc.v1.stksha256.${stkSha256B64u}`;
    const ws = new WebSocket(url, protocol);
    this.ws = ws;

    ws.binaryType = 'arraybuffer';
    ws.onopen = async () => {
      try {
        const { NoiseXX } = await import('../noise/noiseXX');
        this.noise = new NoiseXX();
        await this.noise.init();
        await this.noise.startResponder(ws);
      } catch (e) {
        console.warn('NoiseXX/DevNoise handshake failed or not available', e);
      }
      events?.onOpen?.();
    };
    ws.onerror = (ev) => events?.onError?.(ev);
    ws.onclose = (ev) => events?.onClose?.(ev);
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') {
        const buf = ev.data as ArrayBuffer;
        events?.onCiphertext?.(buf);
        if (this.noise) {
          try { const obj = await this.noise.decryptFrame(buf); if (obj) events?.onJson?.(obj); } catch {}
        }
      } else {
        // Accept plaintext handshake JSON only
        try { const o = JSON.parse(ev.data); if (o?.type?.startsWith('dev_noise')) events?.onJson?.(o); } catch {}
      }
    };
  }

  send(ciphertext: ArrayBuffer | Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(ciphertext);
  }

  sendJson(obj: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.noise) {
      this.noise.encryptJson(obj).then((buf: ArrayBuffer) => this.ws!.send(buf));
    } else {
      // Fallback dev path
      const text = JSON.stringify(obj);
      const data = new TextEncoder().encode(text);
      this.ws.send(data);
    }
  }

  close(code?: number, reason?: string) {
    this.ws?.close(code, reason);
  }
}
