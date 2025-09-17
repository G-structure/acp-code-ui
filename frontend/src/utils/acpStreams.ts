// Stream adapters for ACP over WebSocket (RAT2E relay)

/**
 * Creates Web Streams API compatible streams from a WebSocket connection.
 * This bridges the WebSocket interface with the ACP library's expectation of Web Streams.
 */
export function createACPStreamsFromWebSocket(ws: WebSocket): {
  input: WritableStream<Uint8Array>;
  output: ReadableStream<Uint8Array>;
} {
  // WritableStream to send data to the WebSocket
  const input = new WritableStream<Uint8Array>({
    write(chunk) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      } else {
        throw new Error('WebSocket not open');
      }
    },
    close() {
      ws.close();
    },
    abort(reason) {
      ws.close(1000, reason?.toString());
    },
  });

  // ReadableStream to receive data from the WebSocket
  let outputController: ReadableStreamDefaultController<Uint8Array>;
  
  const output = new ReadableStream<Uint8Array>({
    start(controller) {
      outputController = controller;
      
      // Handle incoming WebSocket messages
      ws.addEventListener('message', (event) => {
        if (event.data instanceof ArrayBuffer) {
          controller.enqueue(new Uint8Array(event.data));
        } else if (event.data instanceof Blob) {
          // Convert Blob to ArrayBuffer
          event.data.arrayBuffer().then(buffer => {
            controller.enqueue(new Uint8Array(buffer));
          });
        } else if (typeof event.data === 'string') {
          // Convert string to Uint8Array
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(event.data));
        }
      });

      // Handle WebSocket close
      ws.addEventListener('close', () => {
        try {
          controller.close();
        } catch (e) {
          // Controller might already be closed
        }
      });

      // Handle WebSocket errors
      ws.addEventListener('error', (event) => {
        try {
          controller.error(new Error('WebSocket error'));
        } catch (e) {
          // Controller might already be closed
        }
      });
    },
    cancel() {
      ws.close();
    },
  });

  return { input, output };
}

/**
 * Creates a message-based bridge for ACP over WebSocket.
 * This handles the JSON-RPC protocol layer over the WebSocket.
 */
export class ACPWebSocketBridge {
  private messageQueue: Uint8Array[] = [];
  private isConnected = false;

  constructor(private ws: WebSocket) {
    ws.addEventListener('open', () => {
      this.isConnected = true;
      // Send any queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) {
          ws.send(message);
        }
      }
    });

    ws.addEventListener('close', () => {
      this.isConnected = false;
    });
  }

  send(data: Uint8Array): void {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      // Queue message for later
      this.messageQueue.push(data);
    }
  }

  onMessage(callback: (data: Uint8Array) => void): void {
    this.ws.addEventListener('message', (event) => {
      if (event.data instanceof ArrayBuffer) {
        callback(new Uint8Array(event.data));
      } else if (event.data instanceof Blob) {
        event.data.arrayBuffer().then(buffer => {
          callback(new Uint8Array(buffer));
        });
      } else if (typeof event.data === 'string') {
        const encoder = new TextEncoder();
        callback(encoder.encode(event.data));
      }
    });
  }

  close(): void {
    this.ws.close();
  }
}