// RAT2E Relay client for Browser UI with ACP support (spec v1)
// Opens WSS to relay with single subprotocol token:
//   "acp.jsonrpc.v1.stksha256.<BASE64URL>"

import { WebACPClient, ACPClientEvents } from './acpClient';
import { createACPStreamsFromWebSocket } from './acpStreams';

export type RelayEvents = {
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;
  onCiphertext?: (data: ArrayBuffer) => void;
  onJson?: (obj: any) => void;
  // ACP-specific events
  onACPReady?: (client: WebACPClient) => void;
  onACPError?: (error: Error) => void;
};

export class Rat2eRelayClient {
  private ws: WebSocket | null = null;
  private noise: any | null = null;
  private acpClient: WebACPClient | null = null;

  connect(opts: {
    relayWsUrl: string; // e.g. wss://relay.example.com/v1/connect
    sessionId: string;
    stkSha256B64u: string; // attach token hash (base64url)
    events?: RelayEvents;
    acpEvents?: ACPClientEvents;
    workingDirectory?: string;
  }) {
    const { relayWsUrl, sessionId, stkSha256B64u, events, acpEvents, workingDirectory } = opts;
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
        
        // Initialize ACP client if requested
        if (acpEvents) {
          await this.initializeACP(ws, acpEvents, workingDirectory);
        }
      } catch (e) {
        console.warn('NoiseXX/DevNoise handshake failed or not available', e);
        events?.onACPError?.(e as Error);
      }
      events?.onOpen?.();
    };
    ws.onerror = (ev) => events?.onError?.(ev);
    ws.onclose = (ev) => events?.onClose?.(ev);
    ws.onmessage = async (ev) => {
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
    this.acpClient = null;
  }

  // ACP integration methods
  private async initializeACP(ws: WebSocket, acpEvents: ACPClientEvents, workingDirectory?: string) {
    try {
      // Create ACP client
      this.acpClient = new WebACPClient({
        events: acpEvents,
        workingDirectory,
        clientCapabilities: {
          fs: {
            readTextFile: true,
            writeTextFile: true,
          },
        },
      });

      // Create streams from WebSocket
      const { input, output } = createACPStreamsFromWebSocket(ws);

      // Initialize ACP connection
      await this.acpClient.initializeConnection(input, output);

      console.log('ACP client initialized successfully');
      // Notify that ACP is ready
      if (acpEvents.onConnectionReady) {
        acpEvents.onConnectionReady();
      }
    } catch (error) {
      console.error('Failed to initialize ACP client:', error);
      if (acpEvents.onConnectionError) {
        acpEvents.onConnectionError(error as Error);
      }
    }
  }

  // ACP client access
  get acp(): WebACPClient | null {
    return this.acpClient;
  }

  // Convenience methods for ACP operations
  async sendACPPrompt(content: string): Promise<void> {
    if (!this.acpClient) {
      throw new Error('ACP client not initialized');
    }

    try {
      const promptContent = [{ type: 'text' as const, text: content }];
      await this.acpClient.prompt(promptContent);
    } catch (error) {
      console.error('Failed to send ACP prompt:', error);
      throw error;
    }
  }

  async createACPSession(workingDirectory?: string): Promise<string> {
    if (!this.acpClient) {
      throw new Error('ACP client not initialized');
    }

    try {
      const result = await this.acpClient.newSession({
        cwd: workingDirectory,
        mcpServers: [],
      });
      return result.sessionId;
    } catch (error) {
      console.error('Failed to create ACP session:', error);
      throw error;
    }
  }
}
