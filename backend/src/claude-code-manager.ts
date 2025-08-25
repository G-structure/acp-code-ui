import { spawn, IPty } from 'node-pty';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import * as fs from 'fs/promises';

interface ClaudeCodeOptions {
  shell?: string;
  cols?: number;
  rows?: number;
}

export class ClaudeCodeManager extends EventEmitter {
  private pty: IPty | null = null;
  public sessionId: string | null = null;
  private outputBuffer: string = '';
  private isProcessing: boolean = false;
  private workingDirectory: string = process.cwd();
  private hasInitialized: boolean = false;
  private lastUserPrompt: string = '';
  private isWaitingForResponse: boolean = false;
  private lastResponseBuffer: string = '';

  constructor(private options: ClaudeCodeOptions = {}) {
    super();
    this.options = {
      shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
      cols: 120,
      rows: 30,
      ...options
    };
  }

  async startSession(workingDirectory?: string): Promise<void> {
    if (this.pty) {
      throw new Error('Session already active');
    }

    this.sessionId = uuidv4();
    this.workingDirectory = workingDirectory || process.cwd();
    const cwd = this.workingDirectory;

    try {
      // Check if directory exists
      const dirExists = await fs.stat(cwd).then(stat => stat.isDirectory()).catch(() => false);
      if (!dirExists) {
        throw new Error(`Directory does not exist: ${cwd}`);
      }
      
      logger.info(`Starting Claude Code session in directory: ${cwd}`);
      
      // Start Claude in TUI mode with session persistence
      this.pty = spawn('claude', [
        '--dangerously-skip-permissions',
        '--session-id', this.sessionId  // Maintain session ID for context
      ], {
        name: 'xterm-256color',
        cols: this.options.cols!,
        rows: this.options.rows!,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color'
        }
      });

      if (!this.pty) {
        throw new Error('PTY spawn returned null');
      }

      this.pty.onData((data) => {
        logger.debug(`Claude output: ${data.substring(0, 200)}`);
        this.outputBuffer += data;
        
        // Process TUI output
        this.processTUIOutput(data);
        
        // Forward raw output to terminal
        this.emit('terminal-output', data);
      });

      this.pty.onExit(({ exitCode, signal }) => {
        logger.info(`Claude Code process exited with code ${exitCode}, signal ${signal}`);
        this.emit('exit', { exitCode, signal });
        this.cleanup();
      });
      
      // Wait for TUI to be ready (no initial message needed)
      this.hasInitialized = false;

      logger.info(`Claude Code session ${this.sessionId} started in ${cwd}`);
    } catch (error) {
      logger.error('Failed to start Claude Code session:', error);
      this.cleanup();
      throw error;
    }
  }

  async stopSession(): Promise<void> {
    if (!this.pty) {
      return;
    }

    try {
      this.pty.kill();
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      logger.error('Error stopping Claude Code session:', error);
    } finally {
      this.cleanup();
    }
  }

  sendPrompt(prompt: string): void {
    if (!this.pty) {
      throw new Error('No active session');
    }

    this.isProcessing = true;
    this.lastUserPrompt = prompt;
    this.isWaitingForResponse = true;
    
    // Send prompt with delay for TUI to process properly
    this.pty.write(prompt);
    setTimeout(() => {
      this.pty!.write('\r');
    }, 50);
    logger.info(`Sent TUI prompt: "${prompt}"`);
    
    // Emit user message for chat display
    this.emit('chat-message', {
      type: 'user',
      content: prompt
    });
  }

  sendCommand(command: string): void {
    if (!this.pty) {
      throw new Error('No active session');
    }

    this.pty.write(command);
  }

  resize(cols: number, rows: number): void {
    if (this.pty) {
      this.pty.resize(cols, rows);
    }
  }

  private processTUIOutput(data: string): void {
    // Add to response buffer
    this.lastResponseBuffer += data;
    
    // Check if Claude is ready for input (prompt appears)
    if (data.includes('│ >') || data.includes('└─')) {
      if (!this.hasInitialized) {
        this.hasInitialized = true;
        this.emit('ready');
        logger.info('Claude TUI is ready for input');
      } else if (this.isWaitingForResponse && this.lastResponseBuffer.length > 0) {
        // Extract the actual response text (remove ANSI codes)
        const cleanText = this.stripAnsi(this.lastResponseBuffer);
        
        // Look for Claude's actual response between prompts
        const lines = cleanText.split('\n').filter(line => 
          line.trim() && 
          !line.includes('│ >') && 
          !line.includes('╭─') && 
          !line.includes('╰─') &&
          !line.includes('└─') &&
          !line.includes('──') &&
          line !== this.lastUserPrompt
        );
        
        if (lines.length > 0) {
          const responseText = lines.join('\n').trim();
          if (responseText && responseText !== this.lastUserPrompt) {
            this.emit('chat-message', {
              type: 'assistant',
              content: responseText
            });
          }
        }
      }
      
      this.isProcessing = false;
      this.isWaitingForResponse = false;
      this.lastResponseBuffer = '';
      this.emit('ready');
    }
    
    // Check for errors
    if (data.includes('Error:')) {
      const errorMatch = data.match(/Error: ([^\n]+)/);
      if (errorMatch) {
        this.emit('error', new Error(errorMatch[1]));
      }
    }
  }
  
  private stripAnsi(str: string): string {
    // Remove ANSI escape codes
    return str.replace(/\x1b\[[0-9;]*m/g, '')
              .replace(/\x1b\[[\?0-9]*[hlHJK]/g, '')
              .replace(/\x1b\[\d+[A-G]/g, '')
              .replace(/\r/g, '');
  }


  private cleanup(): void {
    this.pty = null;
    this.sessionId = null;
    this.outputBuffer = '';
    this.isProcessing = false;
    this.hasInitialized = false;
    this.lastUserPrompt = '';
    this.isWaitingForResponse = false;
    this.lastResponseBuffer = '';
  }

  getStatus(): { active: boolean; sessionId: string | null; processing: boolean } {
    return {
      active: this.pty !== null,
      sessionId: this.sessionId,
      processing: this.isProcessing
    };
  }
}