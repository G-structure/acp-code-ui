import { EventEmitter } from 'events';
import { logger } from './logger';
import { ClaudeCodeManager } from './claude-code-manager-json';

interface HookEvent {
  type: string;
  timestamp: number;
  sessionId?: string;
  data: any;
}

interface ToolUseEvent {
  tool_name: string;
  tool_input: any;
  tool_id?: string;
  result?: any;
}

export class HookServer extends EventEmitter {
  private eventHistory: HookEvent[] = [];
  private readonly maxHistorySize = 1000;

  constructor(private claudeManager: ClaudeCodeManager) {
    super();
  }

  start(): void {
    logger.info('Hook server started');
  }

  stop(): void {
    logger.info('Hook server stopped');
  }

  handleHookEvent(eventType: string, payload: any): void {
    const event: HookEvent = {
      type: eventType,
      timestamp: Date.now(),
      sessionId: this.claudeManager.sessionId || undefined,
      data: payload
    };

    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    logger.debug(`Received hook event: ${eventType}`, payload);
    
    this.processHookEvent(event);
    this.emit('hook-event', event);
  }

  private processHookEvent(event: HookEvent): void {
    switch (event.type) {
      case 'PreToolUse':
        this.handlePreToolUse(event.data as ToolUseEvent);
        break;
        
      case 'PostToolUse':
        this.handlePostToolUse(event.data as ToolUseEvent);
        break;
        
      case 'UserPromptSubmit':
        this.handleUserPromptSubmit(event.data);
        break;
        
      case 'Notification':
        this.handleNotification(event.data);
        break;
        
      case 'Stop':
        this.handleStop(event.data);
        break;
        
      default:
        logger.debug(`Unhandled hook event type: ${event.type}`);
    }
  }

  private handlePreToolUse(data: ToolUseEvent): void {
    logger.info(`Tool use requested: ${data.tool_name}`);
    
    if (this.shouldBlockTool(data)) {
      logger.warn(`Blocking tool use: ${data.tool_name}`);
      process.exit(2);
    }
  }

  private handlePostToolUse(data: ToolUseEvent): void {
    logger.info(`Tool use completed: ${data.tool_name}`);
    
    this.emit('tool-completed', {
      tool: data.tool_name,
      input: data.tool_input,
      result: data.result
    });
  }

  private handleUserPromptSubmit(data: any): void {
    logger.info('User prompt submitted');
    
    this.emit('prompt-submitted', {
      prompt: data.prompt || data.message || data
    });
  }

  private handleNotification(data: any): void {
    logger.info('Notification received');
    
    this.emit('notification', data);
  }

  private handleStop(data: any): void {
    logger.info('Claude Code stopped responding');
    
    this.emit('response-complete', data);
  }

  private shouldBlockTool(data: ToolUseEvent): boolean {
    const blockedTools = process.env.BLOCKED_TOOLS?.split(',') || [];
    const blockedPaths = process.env.BLOCKED_PATHS?.split(',') || [];
    
    if (blockedTools.includes(data.tool_name)) {
      return true;
    }
    
    if (data.tool_name === 'Edit' || data.tool_name === 'Write') {
      const filePath = data.tool_input?.file_path || data.tool_input?.path;
      if (filePath && blockedPaths.some(blocked => filePath.includes(blocked))) {
        return true;
      }
    }
    
    return false;
  }

  getEventHistory(limit: number = 100): HookEvent[] {
    return this.eventHistory.slice(-limit);
  }

  clearEventHistory(): void {
    this.eventHistory = [];
  }
}