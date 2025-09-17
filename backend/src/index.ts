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
import rat2eRoutes from './routes/rat2e';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const wsPort = process.env.WS_PORT || 3002; // Separate WebSocket port
const bindIP = process.env.BIND_IP || 'localhost'; // IP address to bind to
const legacyBackend = process.env.LEGACY_BACKEND === '1';

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for JSON session uploads

const server = createServer(app);

// Legacy backend WebSocket server (disabled by default)
const wss = legacyBackend ? new WebSocketServer({ port: wsPort, host: bindIP }) : null as any;

const claudeManager = new ClaudeCodeManager();
const hookServer = new HookServer(claudeManager);
const fsAPI = new FileSystemAPI();

// Set up event forwarding to all connected clients
claudeManager.on('session-started', (data) => {
  if (!wss) return;
  wss.clients.forEach((client: any) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({ type: 'session-started', data }));
    }
  });
});

claudeManager.on('system-info', (data) => {
  if (!wss) return;
  wss.clients.forEach((client: any) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({ type: 'system-info', data }));
    }
  });
});

// Chat messages
claudeManager.on('chat-message', async (message) => {
  // Log the message to session file
  try {
    const workingDirectory = claudeManager.currentWorkingDirectory || process.cwd();
    const sessionId = claudeManager.sessionId;
    if (sessionId) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const logDir = path.join(workingDirectory, '.claude-debug');
      await fs.mkdir(logDir, { recursive: true });
      
      const logFile = path.join(logDir, `session-${sessionId}.json`);
      const timestamp = new Date().toISOString();
      const logEntry = JSON.stringify({ timestamp, message }) + '\n';
      
      await fs.appendFile(logFile, logEntry);
    }
  } catch (error) {
    logger.debug('Failed to log chat message:', error);
  }
  
  if (!wss) return;
  wss.clients.forEach((client: any) => {
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
  if (!wss) return;
  wss.clients.forEach((client: any) => {
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
  if (!wss) return;
  wss.clients.forEach((client: any) => {
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
  if (!wss) return;
  wss.clients.forEach((client: any) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'json-debug',
        data
      }));
    }
  });
});

claudeManager.on('error', (error) => {
  if (!wss) return;
  wss.clients.forEach((client: any) => {
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
  if (!wss) return;
  wss.clients.forEach((client: any) => {
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

claudeManager.on('session-id-changed', (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'session-id-changed',
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

if (wss) wss.on('connection', (ws: any) => {
  logger.info('New WebSocket connection established');
  
  // Set up ping-pong keepalive
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'ping':
          // Respond to client ping
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        case 'start-session':
          try {
            logger.info(`Starting session with directory: ${data.workingDirectory}${data.sessionId ? `, session ID: ${data.sessionId}` : ''}${data.isNewSession ? ' (new)' : ''}`);
            await claudeManager.startSession(data.workingDirectory, data.sessionId, data.isNewSession);
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
          logger.info(`Received send-prompt request, session ID: ${claudeManager.sessionId}, prompt: "${data.prompt?.substring(0, 50)}..."`);
          
          // Log markdown files if included
          if (data.markdownFiles && data.markdownFiles.length > 0) {
            logger.info(`Including ${data.markdownFiles.length} markdown files as system prompt`);
            // Send to frontend for JSON debug logging
            wss.clients.forEach((client) => {
              if (client.readyState === client.OPEN) {
                client.send(JSON.stringify({
                  type: 'json-debug',
                  data: {
                    type: 'markdown-system-prompt',
                    files: data.markdownFiles,
                    timestamp: new Date().toISOString()
                  }
                }));
              }
            });
          }
          
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
          
        case 'stop-process':
          // Stop just the current Claude process, not the whole session
          logger.info('Received stop-process request');
          await claudeManager.stopCurrentProcess();
          ws.send(JSON.stringify({
            type: 'process-stopped'
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
    ws.isAlive = false;
  });
  
  ws.on('error', (error: Error) => {
    logger.error('WebSocket error:', error);
  });
});

// Set up periodic ping to keep connections alive
const pingInterval = setInterval(() => {
  if (!wss) return; // Skip if WebSocket server is not initialized
  wss.clients.forEach((ws: any) => {
    if (ws.readyState !== ws.OPEN) {
      return; // Skip closed connections
    }
    
    if (ws.isAlive === false) {
      logger.info('Terminating inactive WebSocket connection');
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping(() => {
      // Ping callback - called if ping fails
    });
  });
}, 30000); // Ping every 30 seconds

wss?.on('close', () => {
  clearInterval(pingInterval);
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

app.post('/api/save-file', async (req, res) => {
  const { path, content } = req.body;
  
  if (!path || content === undefined) {
    res.status(400).json({ error: 'Path and content are required' });
    return;
  }
  
  try {
    await fsAPI.writeFile(path, content);
    res.json({ success: true });
  } catch (error: any) {
    logger.error(`Failed to save file ${path}:`, error);
    res.status(500).json({ 
      error: 'Failed to save file',
      message: error.message
    });
  }
});

app.get('/api/markdown-files', async (req, res) => {
  const workingDirectory = req.query.path as string || process.cwd();
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Read the directory
    const files = await fs.readdir(workingDirectory);
    
    // Filter for markdown files
    const markdownFiles = files.filter(file => 
      file.endsWith('.md') || file.endsWith('.markdown')
    );
    
    // Get file stats for each markdown file
    const filesWithStats = await Promise.all(
      markdownFiles.map(async (file) => {
        const filePath = path.join(workingDirectory, file);
        try {
          const stats = await fs.stat(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            modified: stats.mtime.getTime()
          };
        } catch {
          return null;
        }
      })
    );
    
    // Filter out any failed stat calls and sort by name
    const validFiles = filesWithStats
      .filter(file => file !== null)
      .sort((a, b) => a!.name.localeCompare(b!.name));
    
    res.json(validFiles);
  } catch (error: any) {
    logger.error('Failed to list markdown files:', error);
    res.status(500).json({ 
      error: 'Failed to list markdown files',
      message: error.message
    });
  }
});

// RAT2E proxy routes (pairing + presence)
app.use('/api/rat2e', rat2eRoutes);

// Serve Noise XX WASM bundle if provided.
// Priority:
// 1) NOISE_WASM_PATH env var (absolute or relative to CWD)
// 2) backend/static/noise_xx_bg.wasm (checked into repo or mounted at runtime)
app.get('/noise_xx_bg.wasm', async (req, res) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const envPath = process.env.NOISE_WASM_PATH;
    let wasmPath: string | null = null;
    if (envPath) {
      const p = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
      try { await fs.access(p); wasmPath = p; } catch {}
    }
    if (!wasmPath) {
      const fallback = path.resolve(__dirname, '../static/noise_xx_bg.wasm');
      try { await fs.access(fallback); wasmPath = fallback; } catch {}
    }
    if (!wasmPath) {
      res.status(404).send('noise_xx_bg.wasm not found. Provide NOISE_WASM_PATH or place file at backend/static/noise_xx_bg.wasm');
      return;
    }
    const data = await fs.readFile(wasmPath);
    res.setHeader('Content-Type', 'application/wasm');
    res.send(data);
  } catch (err: any) {
    res.status(500).send(`Failed to serve WASM: ${err?.message || err}`);
  }
});

app.post('/api/markdown-content', async (req, res) => {
  const { files } = req.body;
  
  if (!files || !Array.isArray(files)) {
    res.status(400).json({ error: 'Files array is required' });
    return;
  }
  
  try {
    const fs = await import('fs/promises');
    
    // Read all markdown files
    const contents = await Promise.all(
      files.map(async (filePath: string) => {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          return {
            path: filePath,
            name: filePath.split('/').pop() || filePath,
            content
          };
        } catch (error: any) {
          logger.error(`Failed to read markdown file ${filePath}:`, error);
          return {
            path: filePath,
            name: filePath.split('/').pop() || filePath,
            content: '',
            error: error.message
          };
        }
      })
    );
    
    res.json(contents);
  } catch (error: any) {
    logger.error('Failed to read markdown contents:', error);
    res.status(500).json({ 
      error: 'Failed to read markdown contents',
      message: error.message
    });
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
      // Load specific session - try both direct filename and search by Claude session ID
      let sessionFile = `session-${sessionId}.json`;
      let foundFile: string | null = null;
      
      if (sessionFiles.includes(sessionFile)) {
        foundFile = sessionFile;
      } else {
        // Search through files to find one with matching Claude session ID
        for (const file of sessionFiles) {
          try {
            const content = await fs.readFile(path.join(logDir, file), 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
              try {
                const entry = JSON.parse(line);
                if (entry.raw) {
                  const rawData = JSON.parse(entry.raw);
                  if (rawData.type === 'system' && rawData.subtype === 'init' && rawData.session_id === sessionId) {
                    foundFile = file;
                    break;
                  }
                }
                if (entry.parsed?.session_id === sessionId) {
                  foundFile = file;
                  break;
                }
              } catch {
                // Ignore parse errors
              }
            }
            if (foundFile) break;
          } catch {
            // Ignore file read errors
          }
        }
      }
      
      if (foundFile) {
        const content = await fs.readFile(path.join(logDir, foundFile), 'utf-8');
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
        const fileSessionId = file.replace('session-', '').replace('.json', '');
        try {
          const content = await fs.readFile(path.join(logDir, file), 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());
          
          // Extract metadata from the session
          let firstTimestamp: number | null = null;
          let lastTimestamp: number | null = null;
          let messageCount = 0;
          let lastUserPrompt = '';
          let claudeSessionId: string | null = null;
          
          lines.forEach(line => {
            try {
              const entry = JSON.parse(line);
              if (entry.timestamp) {
                const ts = new Date(entry.timestamp).getTime();
                if (!firstTimestamp || ts < firstTimestamp) firstTimestamp = ts;
                if (!lastTimestamp || ts > lastTimestamp) lastTimestamp = ts;
              }
              
              // Extract Claude's actual session ID from init message
              if (entry.raw) {
                try {
                  const rawData = JSON.parse(entry.raw);
                  if (rawData.type === 'system' && rawData.subtype === 'init' && rawData.session_id) {
                    claudeSessionId = rawData.session_id;
                  }
                } catch {
                  // Ignore parse errors
                }
              }
              // Also check parsed messages for session_id
              else if (entry.parsed?.type === 'system' && entry.parsed?.subtype === 'init' && entry.parsed?.session_id) {
                claudeSessionId = entry.parsed.session_id;
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
          
          // Use Claude's session ID if found, otherwise fall back to filename ID
          const sessionId = claudeSessionId || fileSessionId;
          
          return {
            id: sessionId,
            claudeSessionId,
            fileSessionId,
            firstTimestamp,
            lastTimestamp,
            messageCount,
            lastUserPrompt
          };
        } catch {
          return {
            id: fileSessionId,
            claudeSessionId: null,
            fileSessionId,
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

app.post('/api/compact-conversation', async (req, res) => {
  const { sessionId, workingDirectory } = req.body;
  
  if (!sessionId) {
    res.status(400).json({ error: 'Session ID is required' });
    return;
  }
  
  try {
    logger.info(`Starting conversation compaction for session ${sessionId}`);
    
    // Load the session history from JSON file
    const fs = await import('fs/promises');
    const path = await import('path');
    const logDir = path.join(workingDirectory || process.cwd(), '.claude-debug');
    const sessionFile = path.join(logDir, `session-${sessionId}.json`);
    
    let conversationText = '';
    try {
      const content = await fs.readFile(sessionFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // Extract and truncate conversation (remove tool calls, keep user/assistant messages)
      const messages = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          
          // Extract user prompts
          if (entry.type === 'user' && entry.prompt) {
            messages.push(`User: ${entry.prompt}`);
          }
          // Extract assistant messages (from parsed JSON)
          else if (entry.parsed?.type === 'assistant' && entry.parsed?.subtype === 'message' && entry.parsed?.content) {
            // Skip tool use messages
            if (!entry.parsed.content.startsWith('I\'ll') && !entry.parsed.content.includes('tool')) {
              messages.push(`Assistant: ${entry.parsed.content}`);
            }
          }
        } catch {
          // Skip malformed entries
        }
      }
      
      // Limit to last ~50 exchanges to avoid making the summary prompt too long
      const recentMessages = messages.slice(-100); // Last 50 user + 50 assistant messages
      conversationText = recentMessages.join('\n\n');
      
      if (!conversationText) {
        throw new Error('No conversation history found');
      }
    } catch (error: any) {
      logger.error('Failed to load session history:', error);
      // If we can't load history, create a minimal summary request
      conversationText = 'Unable to load full conversation history. Please provide a general summary of our work so far.';
    }
    
    // Run the shadow summarization
    const summary = await claudeManager.runShadowSummarization(conversationText);
    
    res.json({ 
      success: true,
      summary
    });
  } catch (error: any) {
    logger.error('Failed to compact conversation:', error);
    res.status(500).json({ 
      error: 'Failed to compact conversation',
      message: error.message
    });
  }
});

// Add directory history routes
app.use('/api', directoryHistoryRoutes);
app.use('/api/voice', voiceRouter);

server.listen(port, bindIP, () => {
  logger.info(`Claude Code Web UI backend running on ${bindIP}:${port}`);
  if (wss) logger.info(`WebSocket server running on ${bindIP}:${wsPort}`);
  hookServer.start();
});

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await claudeManager.stopSession();
  hookServer.stop();
  process.exit(0);
});
