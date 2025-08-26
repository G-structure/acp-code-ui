import { spawn, IPty } from 'node-pty';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ClaudeCodeOptions {
  shell?: string;
  cols?: number;
  rows?: number;
}

export class ClaudeCodeManager extends EventEmitter {
  public baseSessionId: string | null = null;  // The session ID we're using
  private claudeSessionId: string | null = null;  // Kept for backwards compatibility
  private messageCount: number = 0;  // Track message count for unique IDs
  private isProcessing: boolean = false;
  private workingDirectory: string = process.cwd();
  private currentProcess: IPty | null = null;
  private isResumingExistingSession: boolean = false;  // Track if we're resuming vs creating

  constructor(private options: ClaudeCodeOptions = {}) {
    super();
    this.options = {
      shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
      cols: 120,
      rows: 30,
      ...options
    };
  }

  async startSession(workingDirectory?: string, existingSessionId?: string, isNewSession: boolean = false): Promise<void> {
    // If we already have an active session with this ID, just update the working directory
    if (this.baseSessionId === existingSessionId || this.claudeSessionId === existingSessionId) {
      logger.info(`Session ${existingSessionId} already active, NOT resetting messageCount (currently ${this.messageCount})`);
      this.workingDirectory = workingDirectory || this.workingDirectory;
      this.emit('session-started', { sessionId: this.baseSessionId });
      this.emit('ready');
      return;
    }
    
    // If we're switching to a different session or starting fresh
    if (existingSessionId) {
      if (isNewSession) {
        // Brand new session - reset everything
        this.cleanup(); // Clear any previous session state
        this.baseSessionId = existingSessionId;
        this.messageCount = 0;
        this.isResumingExistingSession = false;  // This is a NEW session
        logger.info(`Starting BRAND NEW session with ID ${existingSessionId}`);
      } else {
        // Resuming an existing session - keep the ID, reset message count
        this.cleanup(); // Clear any previous session state  
        this.baseSessionId = existingSessionId;
        this.messageCount = 0; // Will increment with each message
        this.isResumingExistingSession = true;  // This is an EXISTING session
        logger.info(`Switching to EXISTING session ${existingSessionId}`);
      }
    } else if (!this.baseSessionId) {
      // No session at all - create new one
      this.baseSessionId = uuidv4();
      this.messageCount = 0;
      this.isResumingExistingSession = false;  // New session
      logger.info(`Creating new session with backend-generated ID ${this.baseSessionId}`);
    } else {
      // We have a session but no specific ID was requested - keep current session
      logger.info(`Keeping current session ${this.baseSessionId}, messageCount: ${this.messageCount}, resuming: ${this.isResumingExistingSession}`);
    }
    
    this.workingDirectory = workingDirectory || process.cwd();
    
    logger.info(`Claude Code ready with session ${this.baseSessionId} in directory: ${this.workingDirectory}`);
    
    // Always ready since we spawn per message
    this.emit('session-started', { sessionId: this.baseSessionId });
    this.emit('ready');
  }
  
  get sessionId(): string | null {
    return this.baseSessionId;
  }

  async stopSession(): Promise<void> {
    if (this.currentProcess) {
      try {
        this.currentProcess.kill();
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('Error stopping current Claude process:', error);
      }
    }
    this.cleanup();
  }
  
  async stopCurrentProcess(): Promise<void> {
    if (this.currentProcess) {
      try {
        logger.info('Stopping current Claude process...');
        this.currentProcess.kill();
        this.isProcessing = false;
        await new Promise(resolve => setTimeout(resolve, 100));
        logger.info('Claude process stopped');
        this.emit('ready');
        this.emit('process-stopped', { reason: 'user_interrupted' });
      } catch (error) {
        logger.error('Error stopping current Claude process:', error);
      }
    } else {
      logger.info('No active Claude process to stop');
    }
  }

  sendPrompt(prompt: string): void {
    if (!this.baseSessionId) {
      throw new Error('No active session');
    }

    if (this.isProcessing) {
      logger.warn('Already processing a prompt, ignoring new prompt');
      return;
    }

    this.isProcessing = true;
    this.messageCount++;
    
    logger.info(`Processing prompt ${this.messageCount} for session ${this.baseSessionId}: "${prompt.substring(0, 50)}..."`);
    
    // Log the user prompt for session history
    this.logJsonDebug({
      type: 'user',
      prompt: prompt,
      sessionId: this.baseSessionId,
      messageCount: this.messageCount
    });
    
    // Don't emit user message here - frontend already handles it
    // Just spawn the claude process
    this.spawnClaudeProcess(prompt);
  }

  private async logJsonDebug(data: any): Promise<void> {
    try {
      const logDir = path.join(this.workingDirectory, '.claude-debug');
      await fs.mkdir(logDir, { recursive: true });
      
      // Use Claude's session ID for the log file if available
      const sessionForLog = this.claudeSessionId || this.baseSessionId;
      const logFile = path.join(logDir, `session-${sessionForLog}.json`);
      const timestamp = new Date().toISOString();
      const logEntry = JSON.stringify({ timestamp, ...data }) + '\n';
      
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      logger.debug('Failed to write debug log:', error);
    }
  }

  private spawnClaudeProcess(prompt: string): void {
    logger.info(`Spawning Claude process for prompt: "${prompt.substring(0, 50)}..."`);
    
    // Kill any existing process
    if (this.currentProcess) {
      try {
        this.currentProcess.kill();
      } catch (e) {
        // Ignore
      }
    }
    
    // Always use our baseSessionId - it's either what we generated or what Claude gave us
    const sessionToUse = this.baseSessionId;
    logger.info(`Using session ID: ${sessionToUse} (message #${this.messageCount})`);
    
    // Build args based on whether this is the first message or not
    const args = [
      '--print',  // Non-interactive mode
      '--verbose',  // Required for stream-json with --print
      '--output-format', 'stream-json',
      '--dangerously-skip-permissions'
    ];
    
    // Claude CLI session handling is problematic:
    // - --session-id can only CREATE new sessions (fails if ID exists)
    // - --resume with session ID doesn't work properly in --print mode
    // - --continue only works for the most recent session
    // 
    // Strategy:
    // - For NEW sessions: use --session-id on first message
    // - For EXISTING sessions: always use --continue
    // - For subsequent messages in same session: use --continue
    
    if (this.messageCount === 1 && !this.isResumingExistingSession) {
      // First message of a BRAND NEW session - use --session-id
      if (sessionToUse) {
        args.push('--session-id', sessionToUse);
        logger.info(`Creating NEW session with --session-id ${sessionToUse}`);
      } else {
        // No ID, just create a new session without specific ID
        logger.info('Creating new session without specific ID');
      }
    } else {
      // Either:
      // - First message of an EXISTING session (resuming)
      // - Subsequent messages in any session
      // Use --continue for both cases
      args.push('--continue');
      logger.info(`Message #${this.messageCount}: using --continue (resuming: ${this.isResumingExistingSession})`);
      
      if (this.messageCount === 1 && this.isResumingExistingSession) {
        logger.warn('Note: Using --continue to resume session. This will use the most recent Claude session!');
      }
    }
    
    args.push(prompt);  // The prompt as argument
    
    logger.info(`Claude args: ${args.join(' ')}`);
    
    // Spawn claude with --print for single exchange
    this.currentProcess = spawn('claude', args, {
      name: 'xterm-256color',
      cols: this.options.cols!,
      rows: this.options.rows!,
      cwd: this.workingDirectory,
      env: {
        ...process.env,
        TERM: 'xterm-256color'
      }
    });

    let messageBuffer = '';
    let isStreaming = false;
    let streamMessageId: string | null = null;
    let lastAssistantContent = '';
    let hasEmittedMessage = false;
    let lastJsonDebugData = '';  // Track last debug data to avoid duplicates

    this.currentProcess.onData((data) => {
      // logger.debug(`Claude output: ${data.substring(0, 200)}`);
      messageBuffer += data;
      
      // Emit raw JSON for debugging (deduplicated)
      if (data !== lastJsonDebugData) {
        lastJsonDebugData = data;
        const debugData = { raw: data };
        this.emit('json-debug', debugData);
        this.logJsonDebug(debugData);
      }
      
      // Process complete lines
      const lines = messageBuffer.split('\n');
      messageBuffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            
            // Emit parsed JSON for debugging (deduplicated by checking stringify)
            const messageStr = JSON.stringify(message);
            if (messageStr !== lastJsonDebugData) {
              lastJsonDebugData = messageStr;
              const debugData = { parsed: message };
              this.emit('json-debug', debugData);
              this.logJsonDebug(debugData);
            }
            
            switch (message.type) {
              case 'system':
                if (message.subtype === 'init') {
                  logger.debug('Received init message');
                  
                  // Log the session ID we're using
                  if (message.session_id) {
                    logger.info(`Claude confirmed session ID: ${message.session_id} (our ID was: ${this.baseSessionId})`);
                    
                    // Only update if Claude gave us a different ID than what we requested
                    if (message.session_id !== this.baseSessionId) {
                      const oldId = this.baseSessionId;
                      logger.info(`Claude changed our session ID from ${oldId} to ${message.session_id}`);
                      this.baseSessionId = message.session_id;
                      this.claudeSessionId = message.session_id;
                      
                      // Emit updated session ID
                      this.emit('session-id-changed', { 
                        oldId: oldId, 
                        newId: message.session_id 
                      });
                    } else {
                      // Claude accepted our ID
                      this.claudeSessionId = message.session_id;
                    }
                  }
                  
                  // Emit tool/model info if needed
                  this.emit('system-info', {
                    model: message.model,
                    tools: message.tools,
                    cwd: message.cwd,
                    sessionId: message.session_id
                  });
                } else if (message.subtype === 'usage') {
                  // Emit token usage info
                  this.emit('token-usage', {
                    input_tokens: message.input_tokens,
                    output_tokens: message.output_tokens,
                    cache_creation_input_tokens: message.cache_creation_input_tokens,
                    cache_read_input_tokens: message.cache_read_input_tokens
                  });
                }
                break;
                
              case 'user':
                // Check if this is actually a tool result wrapped in a user message
                if (message.message?.content) {
                  const toolResults = message.message.content.filter((c: any) => c.type === 'tool_result');
                  const toolUses = message.message.content.filter((c: any) => c.type === 'tool_use');
                  
                  // Emit tool results as separate messages
                  toolResults.forEach((toolResult: any) => {
                    this.emit('chat-message', {
                      id: `tool-result-${Date.now()}-${Math.random()}`,
                      type: 'tool_result',
                      content: toolResult.content || 'Tool result',
                      tool_use_id: toolResult.tool_use_id
                    });
                  });
                  
                  // Emit tool uses as separate messages
                  toolUses.forEach((toolUse: any) => {
                    this.emit('chat-message', {
                      id: `tool-use-${Date.now()}-${Math.random()}`,
                      type: 'tool_use',
                      content: `Using tool: ${toolUse.name || 'Unknown'}`,
                      tool_name: toolUse.name,
                      tool_input: toolUse.input
                    });
                  });
                  
                  // Only log if it's not just tool results
                  const hasNonToolContent = message.message.content.some((c: any) => 
                    c.type !== 'tool_result' && c.type !== 'tool_use'
                  );
                  if (hasNonToolContent) {
                    logger.debug('Received user message with mixed content');
                  }
                } else {
                  logger.debug('Received user message echo');
                }
                break;
                
              case 'assistant':
                // Assistant response - handle streaming with deduplication
                if (message.message?.content) {
                  // Check for thinking blocks
                  const thinkingContent = message.message.content
                    .filter((c: any) => c.type === 'thinking')
                    .map((c: any) => c.text)
                    .join('');
                  
                  if (thinkingContent) {
                    // Emit thinking as a separate message type
                    this.emit('chat-message', {
                      id: `thinking-${Date.now()}-${Math.random()}`,
                      type: 'thinking',
                      content: thinkingContent,
                      model: message.message?.model || undefined
                    });
                  }
                  
                  // Check for tool_use blocks in assistant messages
                  const toolUses = message.message.content.filter((c: any) => c.type === 'tool_use');
                  toolUses.forEach((toolUse: any) => {
                    this.emit('chat-message', {
                      id: `tool-use-${Date.now()}-${Math.random()}`,
                      type: 'tool_use',
                      content: `Using tool: ${toolUse.name || 'Unknown'}`,
                      tool_name: toolUse.name,
                      tool_input: toolUse.input
                    });
                    
                    // Special handling for TodoWrite
                    if (toolUse.name === 'TodoWrite' && toolUse.input?.todos) {
                      this.emit('todo-update', {
                        todos: toolUse.input.todos
                      });
                    }
                  });
                  
                  // Extract text content
                  const textContent = message.message.content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text)
                    .join('');
                  
                  if (textContent && textContent !== lastAssistantContent) {
                    lastAssistantContent = textContent;
                    
                    if (!hasEmittedMessage) {
                      // First time seeing content - create new message
                      hasEmittedMessage = true;
                      isStreaming = true;
                      streamMessageId = `msg-${Date.now()}`;
                      
                      // Emit initial assistant message with usage data
                      this.emit('chat-message', {
                        type: 'assistant',
                        content: textContent,
                        id: streamMessageId,
                        streaming: true,
                        model: message.message?.model || undefined,
                        usage: message.message?.usage || undefined
                      });
                      
                      // Emit token usage if available
                      if (message.message?.usage) {
                        this.emit('token-usage', message.message.usage);
                      }
                    } else if (isStreaming) {
                      // Update existing streaming message
                      this.emit('chat-message-update', {
                        id: streamMessageId,
                        content: textContent,
                        model: message.message?.model || undefined,
                        usage: message.message?.usage || undefined
                      });
                      
                      // Emit token usage if available
                      if (message.message?.usage) {
                        this.emit('token-usage', message.message.usage);
                      }
                    }
                    logger.debug(`Assistant message: ${textContent.substring(0, 100)}...`);
                  }
                }
                break;
                
              case 'tool_use':
                // Tool being used
                this.emit('tool-use', {
                  tool: message.tool_name,
                  input: message.tool_input
                });
                // Also emit as a chat message for display
                this.emit('chat-message', {
                  id: `tool-use-${Date.now()}-${Math.random()}`,
                  type: 'tool_use',
                  content: `Using tool: ${message.tool_name}`,
                  tool_name: message.tool_name,
                  tool_input: message.tool_input
                });
                break;
                
              case 'tool_result':
                // Tool result
                this.emit('tool-result', {
                  tool: message.tool_name,
                  output: message.tool_result
                });
                // Also emit as a chat message for display
                this.emit('chat-message', {
                  id: `tool-result-${Date.now()}-${Math.random()}`,
                  type: 'tool_result',
                  content: `Tool result from: ${message.tool_name}`,
                  tool_name: message.tool_name,
                  tool_result: message.tool_result
                });
                break;
                
              case 'result':
                // Final result with complete token usage
                if (message.usage) {
                  this.emit('token-usage', message.usage);
                  logger.debug(`Final token usage - Input: ${message.usage.input_tokens}, Output: ${message.usage.output_tokens}`);
                }
                break;
                
              case 'error':
                // Error from Claude
                this.emit('error', new Error(message.error || 'Unknown error'));
                this.isProcessing = false;
                break;
                
              default:
                logger.debug(`Unknown message type: ${message.type}`);
            }
          } catch (e) {
            // Not JSON, might be error output
            if (line.includes('Error:')) {
              logger.error('Claude error:', line);
              this.emit('error', new Error(line));
              this.isProcessing = false;
            } else {
              logger.debug(`Non-JSON output: ${line.substring(0, 100)}`);
            }
          }
        }
      }
    });

    this.currentProcess.onExit(({ exitCode, signal }) => {
      logger.debug(`Claude process exited with code ${exitCode}, signal ${signal}`);
      
      // Finalize streaming if active
      if (isStreaming && streamMessageId) {
        this.emit('chat-message-finalize', {
          id: streamMessageId
        });
      }
      
      this.isProcessing = false;
      this.currentProcess = null;
      this.emit('ready');
    });
  }

  sendCommand(_command: string): void {
    // Not used in JSON mode
    logger.warn('sendCommand not supported in JSON mode');
  }

  resize(cols: number, rows: number): void {
    this.options.cols = cols;
    this.options.rows = rows;
  }

  // Run a one-shot shadow session for summarization
  async runShadowSummarization(conversationText: string): Promise<string> {
    return new Promise((resolve, reject) => {
      logger.info('Starting shadow summarization session...');
      
      const summaryPrompt = `You are being asked to summarize a conversation between a user and Claude Code. 
Please provide a concise summary of the conversation, focusing on:
1. The main task or problem being worked on
2. Key decisions and solutions implemented
3. Current status and any unresolved issues
4. Important context that should be preserved

Keep the summary focused and under 500 words. Format it as if you're continuing the conversation.

Here is the conversation to summarize:

${conversationText}

Please provide a clear, concise summary that captures the essence of this conversation:`;

      // Spawn a one-shot claude process just for summarization
      const shadowProcess = spawn('claude', [
        '--print',  // Non-interactive mode
        '--verbose',  // Required for stream-json
        '--output-format', 'stream-json',
        '--dangerously-skip-permissions',
        summaryPrompt
      ], {
        name: 'xterm-256color',
        cols: this.options.cols!,
        rows: this.options.rows!,
        cwd: this.workingDirectory,
        env: {
          ...process.env,
          TERM: 'xterm-256color'
        }
      });

      let summaryBuffer = '';
      let summaryContent = '';
      let hasError = false;

      shadowProcess.onData((data) => {
        summaryBuffer += data;
        
        // Process complete lines
        const lines = summaryBuffer.split('\n');
        summaryBuffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              
              // Extract assistant message content
              if (message.type === 'assistant' && message.subtype === 'message') {
                if (message.content) {
                  summaryContent += message.content;
                }
              } else if (message.type === 'error') {
                hasError = true;
                reject(new Error(message.message || 'Summarization failed'));
                shadowProcess.kill();
              }
            } catch (e) {
              // Not JSON, might be other output
              logger.debug('Shadow session non-JSON output:', line);
            }
          }
        }
      });

      shadowProcess.onExit((exitCode) => {
        logger.info(`Shadow summarization process exited with code ${exitCode}`);
        if (!hasError) {
          if (summaryContent) {
            resolve(summaryContent);
          } else {
            reject(new Error('No summary generated'));
          }
        }
      });

      // Set a timeout for the summarization
      setTimeout(() => {
        shadowProcess.kill();
        reject(new Error('Summarization timed out'));
      }, 60000); // 1 minute timeout
    });
  }

  private cleanup(): void {
    this.baseSessionId = null;
    this.claudeSessionId = null;
    this.messageCount = 0;
    this.isProcessing = false;
    this.currentProcess = null;
    this.isResumingExistingSession = false;
  }

  getStatus(): { active: boolean; sessionId: string | null; processing: boolean } {
    return {
      active: this.sessionId !== null,
      sessionId: this.sessionId,
      processing: this.isProcessing
    };
  }
}