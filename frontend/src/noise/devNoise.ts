// DevNoise: temporary Noise-like handshake and AES-GCM framing (NOT secure)
// Establishes a shared key by exchanging random 32-byte nonces.

export class DevNoise {
  private key: CryptoKey | null = null;

  async handleInitAndRespond(ws: WebSocket) {
    // Wait for dev_noise_init, then respond
    const browserRand = crypto.getRandomValues(new Uint8Array(32));
    const init = await this.waitForInit(ws);
    const ratRand = base64UrlDecode(init.rat_rand);
    const keyMaterial = await crypto.subtle.digest('SHA-256', concat(ratRand, browserRand));
    this.key = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['encrypt', 'decrypt']);
    const resp = { type: 'dev_noise_resp', browser_rand: base64UrlEncode(browserRand) };
    ws.send(JSON.stringify(resp)); // plain JSON; relay forwards but ignores non-binary
  }

  async encryptJson(obj: any): Promise<ArrayBuffer> {
    if (!this.key) throw new Error('key not ready');
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(obj));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, this.key, plaintext);
    const out = new Uint8Array(1 + 12 + ciphertext.byteLength);
    out[0] = 0xEE; out.set(nonce, 1); out.set(new Uint8Array(ciphertext), 13);
    return out.buffer;
  }

  async decryptFrame(buf: ArrayBuffer): Promise<any | null> {
    if (!this.key) return null;
    const data = new Uint8Array(buf);
    if (data.length <= 13 || data[0] !== 0xEE) return null;
    const nonce = data.slice(1, 13);
    const ct = data.slice(13);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, this.key!, ct);
    return JSON.parse(new TextDecoder().decode(new Uint8Array(plain)));
  }

  private waitForInit(ws: WebSocket): Promise<{ rat_rand: string }> {
    return new Promise((resolve, reject) => {
      const handler = (ev: MessageEvent) => {
        try {
          const o = JSON.parse(typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(new Uint8Array(ev.data)));
          if (o && o.type === 'dev_noise_init' && typeof o.rat_rand === 'string') {
            ws.removeEventListener('message', handler as any);
            resolve({ rat_rand: o.rat_rand });
          }
        } catch {}
      };
      ws.addEventListener('message', handler as any);
      setTimeout(() => reject(new Error('timeout waiting for init')), 10000);
    });
  }
}

function base64UrlEncode(u8: Uint8Array): string {
  return btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64UrlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : '';
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

