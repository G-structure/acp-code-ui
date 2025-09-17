// Minimal RAT2E Relay client for Browser UI (spec v1 start)
// Opens WSS to relay with single subprotocol token:
//   "acp.jsonrpc.v1.stksha256.<BASE64URL>"

export type RelayEvents = {
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;
  onCiphertext?: (data: ArrayBuffer) => void;
};

export class Rat2eRelayClient {
  private ws: WebSocket | null = null;

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
    ws.onopen = () => events?.onOpen?.();
    ws.onerror = (ev) => events?.onError?.(ev);
    ws.onclose = (ev) => events?.onClose?.(ev);
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') {
        // Ciphertext frames only per spec; application plaintext is E2E encrypted
        events?.onCiphertext?.(ev.data as ArrayBuffer);
      }
      // Any plaintext strings before Noise is established should be ignored in v1
    };
  }

  send(ciphertext: ArrayBuffer | Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(ciphertext);
  }

  close(code?: number, reason?: string) {
    this.ws?.close(code, reason);
  }
}

