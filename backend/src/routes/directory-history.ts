import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const router = Router();

// Store history in user's home directory
const HISTORY_FILE = path.join(os.homedir(), '.claude-code-ui-history.json');
const MAX_HISTORY = 10;

interface DirectoryHistory {
  directories: Array<{
    path: string;
    lastUsed: string;
    sessionCount?: number;
  }>;
}

async function loadHistory(): Promise<DirectoryHistory> {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid, return empty history
    return { directories: [] };
  }
}

async function saveHistory(history: DirectoryHistory): Promise<void> {
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Get directory history
router.get('/directory-history', async (req, res) => {
  try {
    const history = await loadHistory();
    res.json(history);
  } catch (error) {
    console.error('Failed to load directory history:', error);
    res.status(500).json({ error: 'Failed to load directory history' });
  }
});

// Add or update directory in history
router.post('/directory-history', async (req, res) => {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const history = await loadHistory();
    
    // Remove existing entry if present
    const existingIndex = history.directories.findIndex(d => d.path === dirPath);
    if (existingIndex !== -1) {
      history.directories.splice(existingIndex, 1);
    }
    
    // Add to front of list
    history.directories.unshift({
      path: dirPath,
      lastUsed: new Date().toISOString()
    });
    
    // Keep only MAX_HISTORY items
    history.directories = history.directories.slice(0, MAX_HISTORY);
    
    await saveHistory(history);
    res.json(history);
  } catch (error) {
    console.error('Failed to save directory history:', error);
    res.status(500).json({ error: 'Failed to save directory history' });
  }
});

// Load and merge JSON session
router.post('/load-json-session', async (req, res) => {
  try {
    const { jsonData, sessionId } = req.body;
    if (!jsonData || !Array.isArray(jsonData)) {
      return res.status(400).json({ error: 'Invalid JSON data' });
    }

    // Process the JSON data to extract messages
    const messages: any[] = [];
    
    jsonData.forEach((entry: any) => {
      // Handle user prompts
      if (entry.type === 'user' && entry.prompt) {
        messages.push({
          id: `imported-${Date.now()}-${Math.random()}`,
          type: 'user',
          content: entry.prompt,
          timestamp: new Date(entry.timestamp || Date.now()).getTime()
        });
      }
      // Handle assistant messages
      else if (entry.parsed) {
        const msg = entry.parsed;
        if (msg.type === 'assistant' && msg.message) {
          const textContent = msg.message.content
            ?.filter((c: any) => c.type === 'text')
            ?.map((c: any) => c.text)
            ?.join('') || '';
          
          if (textContent) {
            messages.push({
              id: `imported-${Date.now()}-${Math.random()}`,
              type: 'assistant',
              content: textContent,
              tokens: msg.message.usage?.output_tokens,
              model: msg.message.model,
              timestamp: new Date(entry.timestamp || Date.now()).getTime()
            });
          }
        }
      }
    });

    res.json({ 
      success: true, 
      messages,
      messageCount: messages.length 
    });
  } catch (error) {
    console.error('Failed to load JSON session:', error);
    res.status(500).json({ error: 'Failed to process JSON session' });
  }
});

export default router;