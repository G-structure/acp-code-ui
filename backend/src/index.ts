import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { createServer } from 'http';
import { ClaudeCodeManager } from './claude-code-manager-json';
import { HookServer } from './hook-server';
import { FileSystemAPI } from './filesystem-api';
import { logger } from './logger';
import directoryHistoryRoutes from './routes/directory-history';
import voiceRouter from './routes/voice';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for JSON session uploads

const server = createServer(app);
const wss = new WebSocketServer({ server });

const claudeManager = new ClaudeCodeManager();
const hookServer = new HookServer(claudeManager);
const fsAPI = new FileSystemAPI();

// Set up event forwarding to all connected clients
claudeManager.on('session-started', (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'session-started',
        data
      }));
    }
  });
});

claudeManager.on('system-info', (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'system-info',
        data
      }));
    }
  });
});

// Chat messages
claudeManager.on('chat-message', (message) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'chat-message',
        message
      }));
    }
  });
});

// Chat message updates (for streaming)
claudeManager.on('chat-message-update', (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'chat-message-update',
        data
      }));
    }
  });
});

// Chat message finalize (end of streaming)
claudeManager.on('chat-message-finalize', (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'chat-message-finalize',
        data
      }));
    }
  });
});

// JSON debug events
claudeManager.on('json-debug', (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'json-debug',
        data
      }));
    }
  });
});

claudeManager.on('error', (error) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  });
});

claudeManager.on('ready', () => {
  logger.info('Claude is ready, notifying clients');
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'ready'
      }));
    }
  });
});

// Tool use events from JSON mode
claudeManager.on('tool-use', (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'tool-use',
        data
      }));
    }
  });
});

claudeManager.on('tool-result', (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'tool-result',
        data
      }));
    }
  });
});

// Todo updates from TodoWrite tool
claudeManager.on('todo-update', (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'todo-update',
        data
      }));
    }
  });
});

claudeManager.on('token-usage', (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'token-usage',
        data
      }));
    }
  });
});


hookServer.on('hook-event', (event) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'hook-event',
        event
      }));
    }
  });
});

wss.on('connection', (ws) => {
  logger.info('New WebSocket connection established');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'start-session':
          try {
            logger.info(`Starting session with directory: ${data.workingDirectory}`);
            await claudeManager.startSession(data.workingDirectory);
            logger.info(`Session started with ID: ${claudeManager.sessionId}`);
            ws.send(JSON.stringify({
              type: 'session-started',
              data: {
                sessionId: claudeManager.sessionId
              }
            }));
          } catch (sessionError: any) {
            logger.error('Failed to start session:', sessionError);
            ws.send(JSON.stringify({
              type: 'error',
              error: sessionError.message || 'Failed to start Claude Code session. Is Claude Code installed?'
            }));
          }
          break;
          
        case 'send-prompt':
          logger.info(`Sending prompt, session ID: ${claudeManager.sessionId}`);
          try {
            claudeManager.sendPrompt(data.prompt);
          } catch (error: any) {
            logger.error('Error sending prompt:', error);
            ws.send(JSON.stringify({
              type: 'error',
              error: error.message || 'Failed to send prompt'
            }));
          }
          break;
          
        case 'stop-session':
          await claudeManager.stopSession();
          ws.send(JSON.stringify({
            type: 'session-stopped'
          }));
          break;
          
        case 'send-command':
          claudeManager.sendCommand(data.command);
          break;
          
        default:
          logger.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      logger.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to process message'
      }));
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket connection closed');
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/api/files', async (req, res) => {
  const path = req.query.path as string || process.cwd();
  try {
    const files = await fsAPI.listFiles(path);
    res.json(files);
  } catch (error: any) {
    logger.error(`Failed to list files in ${path}:`, error);
    res.status(500).json({ 
      error: 'Failed to list files',
      message: error.message,
      path
    });
  }
});

app.get('/api/file-content', async (req, res) => {
  const path = req.query.path as string;
  if (!path) {
    res.status(400).json({ error: 'Path is required' });
    return;
  }
  
  try {
    const content = await fsAPI.readFile(path);
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

app.get('/api/session-history', async (req, res) => {
  const workingDirectory = req.query.path as string || process.cwd();
  const sessionId = req.query.sessionId as string;
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const logDir = path.join(workingDirectory, '.claude-debug');
    
    // Check if log directory exists
    try {
      await fs.access(logDir);
    } catch {
      res.json({ sessions: [], messages: [] });
      return;
    }
    
    // List all session files
    const files = await fs.readdir(logDir);
    const sessionFiles = files.filter(f => f.startsWith('session-') && f.endsWith('.json'));
    
    if (sessionId) {
      // Load specific session
      const sessionFile = `session-${sessionId}.json`;
      if (sessionFiles.includes(sessionFile)) {
        const content = await fs.readFile(path.join(logDir, sessionFile), 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        const messages = lines.map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        }).filter(msg => msg !== null);
        
        res.json({ sessions: [sessionId], messages });
      } else {
        res.json({ sessions: [], messages: [] });
      }
    } else {
      // List available sessions with metadata
      const sessions = await Promise.all(sessionFiles.map(async (file) => {
        const sessionId = file.replace('session-', '').replace('.json', '');
        try {
          const content = await fs.readFile(path.join(logDir, file), 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());
          
          // Extract metadata from the session
          let firstTimestamp: number | null = null;
          let lastTimestamp: number | null = null;
          let messageCount = 0;
          let lastUserPrompt = '';
          
          lines.forEach(line => {
            try {
              const entry = JSON.parse(line);
              if (entry.timestamp) {
                const ts = new Date(entry.timestamp).getTime();
                if (!firstTimestamp || ts < firstTimestamp) firstTimestamp = ts;
                if (!lastTimestamp || ts > lastTimestamp) lastTimestamp = ts;
              }
              // Count our custom user prompt logging
              if (entry.type === 'user' && entry.prompt) {
                messageCount++;
                lastUserPrompt = entry.prompt.substring(0, 50);
              }
              // Also check parsed messages
              else if (entry.parsed?.type === 'user' && entry.parsed?.prompt) {
                messageCount++;
                lastUserPrompt = entry.parsed.prompt.substring(0, 50);
              } else if (entry.parsed?.type === 'assistant') {
                messageCount++;
              }
            } catch {
              // Ignore malformed lines
            }
          });
          
          return {
            id: sessionId,
            firstTimestamp,
            lastTimestamp,
            messageCount,
            lastUserPrompt
          };
        } catch {
          return {
            id: sessionId,
            firstTimestamp: null,
            lastTimestamp: null,
            messageCount: 0,
            lastUserPrompt: ''
          };
        }
      }));
      
      res.json({ sessions, messages: [] });
    }
  } catch (error: any) {
    logger.error('Failed to load session history:', error);
    res.status(500).json({ 
      error: 'Failed to load session history',
      message: error.message
    });
  }
});

app.post('/api/hooks/:event', (req, res) => {
  hookServer.handleHookEvent(req.params.event, req.body);
  res.json({ status: 'received' });
});

// Add directory history routes
app.use('/api', directoryHistoryRoutes);
app.use('/api/voice', voiceRouter);

server.listen(port, () => {
  logger.info(`Claude Code Web UI backend running on port ${port}`);
  hookServer.start();
});

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await claudeManager.stopSession();
  hookServer.stop();
  process.exit(0);
});