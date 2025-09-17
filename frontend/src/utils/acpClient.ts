// ACP Client implementation for Web UI
import * as acp from '@zed-industries/agent-client-protocol';

// Types for UI integration
export interface ACPClientEvents {
  onSessionUpdate?: (update: acp.SessionNotification) => void;
  onPermissionRequest?: (request: acp.RequestPermissionRequest) => Promise<acp.RequestPermissionResponse>;
  onReadTextFile?: (request: acp.ReadTextFileRequest) => Promise<acp.ReadTextFileResponse>;
  onWriteTextFile?: (request: acp.WriteTextFileRequest) => Promise<acp.WriteTextFileResponse>;
  onConnectionError?: (error: Error) => void;
  onConnectionReady?: () => void;
}

export interface ACPConnectionConfig {
  events: ACPClientEvents;
  workingDirectory?: string;
  clientCapabilities?: acp.ClientCapabilities;
}

/**
 * ACP Client wrapper for the web UI that integrates with RAT2E relay.
 * This provides the browser's view of an ACP connection, implementing
 * the Client interface to handle agent requests.
 */
export class WebACPClient implements acp.Client {
  private connection: acp.ClientSideConnection | null = null;
  private events: ACPClientEvents;
  private isInitialized = false;
  private currentSessionId: string | null = null;

  constructor(private config: ACPConnectionConfig) {
    this.events = config.events;
  }

  /**
   * Initialize the ACP connection with given streams (from RAT2E)
   */
  async initializeConnection(
    input: WritableStream<Uint8Array>,
    output: ReadableStream<Uint8Array>
  ): Promise<acp.InitializeResponse> {
    try {
      // Create the client connection
      this.connection = new acp.ClientSideConnection(
        () => this, // Return this as the Client implementation
        input,
        output
      );

      // Initialize the connection
      const initResult = await this.connection.initialize({
        protocolVersion: acp.PROTOCOL_VERSION,
        clientCapabilities: this.config.clientCapabilities || {
          fs: {
            readTextFile: true,
            writeTextFile: true,
          },
        },
      });

      this.isInitialized = true;
      this.events.onConnectionReady?.();

      return initResult;
    } catch (error) {
      this.events.onConnectionError?.(error as Error);
      throw error;
    }
  }

  /**
   * Create a new ACP session
   */
  async newSession(params?: {
    cwd?: string;
    mcpServers?: any[];
  }): Promise<acp.NewSessionResponse> {
    if (!this.connection || !this.isInitialized) {
      throw new Error('ACP connection not initialized');
    }

    const sessionResult = await this.connection.newSession({
      cwd: params?.cwd || this.config.workingDirectory || process.cwd(),
      mcpServers: params?.mcpServers || [],
    });

    this.currentSessionId = sessionResult.sessionId;
    return sessionResult;
  }

  /**
   * Load an existing session
   */
  async loadSession(sessionId: string, cwd?: string): Promise<acp.LoadSessionResponse> {
    if (!this.connection || !this.isInitialized) {
      throw new Error('ACP connection not initialized');
    }

    const result = await this.connection.loadSession({ 
      sessionId, 
      cwd: cwd || this.config.workingDirectory || process.cwd(),
      mcpServers: []
    });
    this.currentSessionId = sessionId;
    return result;
  }

  /**
   * Send a prompt to the agent
   */
  async prompt(content: any[]): Promise<acp.PromptResponse> {
    if (!this.connection || !this.isInitialized || !this.currentSessionId) {
      throw new Error('ACP connection not ready or no session active');
    }

    return await this.connection.prompt({
      sessionId: this.currentSessionId,
      prompt: content,
    });
  }

  /**
   * Cancel the current session
   */
  async cancel(): Promise<void> {
    if (!this.connection || !this.currentSessionId) {
      return;
    }

    await this.connection.cancel({
      sessionId: this.currentSessionId,
    });
  }

  // Client interface implementation
  async requestPermission(
    params: acp.RequestPermissionRequest
  ): Promise<acp.RequestPermissionResponse> {
    if (this.events.onPermissionRequest) {
      return await this.events.onPermissionRequest(params);
    }

    // Default: approve all permissions
    console.warn('No permission handler configured, auto-approving:', params.toolCall.title);
    return {
      outcome: {
        outcome: 'selected',
        optionId: params.options.find(opt => opt.kind === 'allow_once' || opt.kind === 'allow_always')?.optionId || params.options[0]?.optionId,
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    this.events.onSessionUpdate?.(params);
  }

  async readTextFile(
    params: acp.ReadTextFileRequest
  ): Promise<acp.ReadTextFileResponse> {
    if (this.events.onReadTextFile) {
      return await this.events.onReadTextFile(params);
    }

    // Default implementation: try to read via API
    try {
      const response = await fetch(`/api/file-content?path=${encodeURIComponent(params.path)}`);
      if (!response.ok) {
        throw new Error(`Failed to read file: ${response.statusText}`);
      }
      const data = await response.text();
      return { content: data };
    } catch (error) {
      console.error('Failed to read file:', error);
      return { content: `Error reading file: ${error}` };
    }
  }

  async writeTextFile(
    params: acp.WriteTextFileRequest
  ): Promise<acp.WriteTextFileResponse> {
    if (this.events.onWriteTextFile) {
      return await this.events.onWriteTextFile(params);
    }

    // Default implementation: try to write via API
    try {
      const response = await fetch('/api/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: params.path, content: params.content }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to write file: ${response.statusText}`);
      }
      
      return {}; // Success - return empty object instead of null
    } catch (error) {
      console.error('Failed to write file:', error);
      throw error;
    }
  }

  // Getters for current state
  get sessionId(): string | null {
    return this.currentSessionId;
  }

  get ready(): boolean {
    return this.isInitialized && this.connection !== null;
  }
}

// Helper function to create ACP content from different input types
export function createACPContent(input: string | { type: string; content?: string; text?: string }[]): any[] {
  if (typeof input === 'string') {
    return [{ type: 'text', text: input }];
  }
  
  return input.map(item => {
    if (item.type === 'text') {
      return { type: 'text', text: item.text || item.content || '' };
    }
    // Add support for other content types as needed
    return { type: 'text', text: item.content || item.text || '' };
  });
}