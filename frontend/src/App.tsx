import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  Divider,
  TextField,
  Button,
  Chip,
  Tabs,
  Tab,
  Autocomplete,
  Menu,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  MoreVert as MoreVertIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import FileExplorer from './components/FileExplorer';
import ChatInterface from './components/ChatInterface';
import HookEventMonitor from './components/HookEventMonitor';
import JsonDebugViewer from './components/JsonDebugViewer';
import TodoPanel from './components/TodoPanel';
import ResizablePanel from './components/ResizablePanel';
import CodeEditor from './components/CodeEditor';
// Legacy backend WebSocket removed; use RAT2E relay with ACP support
import { Rat2eRelayClient } from './utils/rat2eRelay';
import { WebACPClient } from './utils/acpClient';
import { useClaudeStore } from './store/claudeStore';
import * as acp from '@zed-industries/agent-client-protocol';

const DRAWER_WIDTH = 360;

function App() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'chat' | 'terminal' | 'hooks' | 'json' | 'editor'>('chat');
  const [workingDirectory, setWorkingDirectory] = useState('');
  
  // Get directory from URL hash or use default
  const getInitialDirectory = () => {
    const hash = window.location.hash.slice(1); // Remove the #
    if (hash && hash.startsWith('/')) {
      return decodeURIComponent(hash);
    }
    return window.location.pathname.startsWith('/home') ? window.location.pathname : '/tmp';
  };
  
  const [directoryInput, setDirectoryInput] = useState(getInitialDirectory());
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [availableSessions, setAvailableSessions] = useState<any[]>([]);
  const [directoryHistory, setDirectoryHistory] = useState<string[]>([]);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [directorySelectionMode, setDirectorySelectionMode] = useState(false);
  const directoryTimeout = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasStartedSession = useRef(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  // RAT2E with ACP minimal pairing/connect state
  const [ratUserCode, setRatUserCode] = useState('');
  const [ratStatus, setRatStatus] = useState('');
  const ratRelayRef = useRef<Rat2eRelayClient | null>(null);
  const acpClientRef = useRef<WebACPClient | null>(null);

  // ACP event handlers
  const handleACPSessionUpdate = useCallback((notification: acp.SessionNotification) => {
    const { addMessage, updateMessage, setProcessingStatus } = useClaudeStore.getState();
    const update = notification.update;

    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        if (update.content.type === 'text') {
          // Handle text content from agent
          const messageId = `acp-msg-${Date.now()}`;
          addMessage({
            id: messageId,
            type: 'assistant' as const,
            content: update.content.text,
            timestamp: Date.now()
          });
        }
        break;

      case 'tool_call':
        // Handle tool call start
        addMessage({
          id: update.toolCallId,
          type: 'tool_use' as const,
          content: `🔧 ${update.title} (${update.status})`,
          tool_name: update.title,
          timestamp: Date.now()
        });
        break;

      case 'tool_call_update':
        // Handle tool call progress updates
        updateMessage(
          update.toolCallId,
          `🔧 Tool call updated: ${update.status}`,
          {}
        );
        break;

      case 'plan':
        // Handle execution plan
        addMessage({
          id: `plan-${Date.now()}`,
          type: 'system' as const,
          content: `📋 Plan: ${JSON.stringify(update.entries)}`,
          timestamp: Date.now()
        });
        break;

      case 'agent_thought_chunk':
        // Handle agent thoughts
        setProcessingStatus(`💭 ${update.content.type === 'text' ? update.content.text.slice(0, 200) : 'Thinking...'}`);
        break;

      case 'user_message_chunk':
        // Handle user message chunks (if needed)
        break;

      default:
        console.log('Unhandled ACP session update:', update);
    }
  }, []);

  const handleACPPermissionRequest = useCallback(async (request: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> => {
    // For now, show a browser prompt - in a real app you'd want a proper UI
    const approved = window.confirm(
      `Permission requested: ${request.toolCall.title}\n\nOptions:\n${request.options.map(opt => `- ${opt.name} (${opt.kind})`).join('\n')}\n\nApprove?`
    );

    if (approved) {
      const approvedOption = request.options.find(opt => opt.kind === 'allow_once' || opt.kind === 'allow_always') || request.options[0];
      return {
        outcome: {
          outcome: 'selected',
          optionId: approvedOption.optionId,
        }
      };
    } else {
      const rejectedOption = request.options.find(opt => opt.kind === 'reject_once' || opt.kind === 'reject_always') || request.options[0];
      return {
        outcome: {
          outcome: 'selected',
          optionId: rejectedOption.optionId,
        }
      };
    }
  }, []);

  const connectRat2e = useCallback(async () => {
    try {
      if (!ratUserCode) { setRatStatus('Enter code'); return; }
      setRatStatus('Completing...');
      const r = await fetch('/api/rat2e/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_code: ratUserCode })
      });
      if (!r.ok) { setRatStatus(`Complete failed: ${r.status}`); return; }
      const data = await r.json();
      const relayWsUrl = data.relay_ws_url as string;
      const sessionId = data.session_id as string;
      const token = data.attach_token_sha256 as string;
      const client = new Rat2eRelayClient();
      ratRelayRef.current = client;
      client.connect({
        relayWsUrl,
        sessionId,
        stkSha256B64u: token,
        workingDirectory,
        events: {
          onOpen: () => setRatStatus('Connected'),
          onClose: () => setRatStatus('Closed'),
          onError: () => setRatStatus('Error'),
          onACPReady: (acpClient) => {
            console.log('ACP client ready');
            acpClientRef.current = acpClient;
            setRatStatus('ACP Ready');
          },
          onACPError: (error) => {
            console.error('ACP error:', error);
            setRatStatus(`ACP Error: ${error.message}`);
          },
          onCiphertext: (buf) => {
            console.debug('RAT2E frame', buf.byteLength);
          },
          onJson: (obj) => {
            // Legacy handler for non-ACP messages (fallback)
            try {
              const { addMessage, updateMessage, finalizeMessage, setProcessingStatus } = useClaudeStore.getState();
              if (obj.type === 'chat-message' && obj.message) {
                addMessage(obj.message);
              } else if (obj.type === 'chat-message-update' && obj.data?.id) {
                updateMessage(obj.data.id, obj.data.content || '', { model: obj.data.model, tokens: obj.data.usage?.output_tokens });
              } else if (obj.type === 'chat-message-finalize' && obj.data?.id) {
                finalizeMessage(obj.data.id);
              } else if (obj.type === 'thinking' && obj.content) {
                setProcessingStatus(`💭 ${String(obj.content).slice(0, 200)}`);
                addMessage({ id: `thinking-${Date.now()}`, type: 'thinking', content: obj.content, timestamp: Date.now() });
              }
            } catch (e) { console.error('Failed to handle RAT2E JSON', e, obj); }
          }
        },
        acpEvents: {
          onSessionUpdate: (notification) => {
            console.log('ACP session update:', notification);
            handleACPSessionUpdate(notification);
          },
          onPermissionRequest: async (request) => {
            console.log('ACP permission request:', request);
            return await handleACPPermissionRequest(request);
          },
          onConnectionReady: () => {
            console.log('ACP connection established');
            setRatStatus('ACP Connected');
          },
          onConnectionError: (error) => {
            console.error('ACP connection error:', error);
            setRatStatus(`ACP Error: ${error.message}`);
          }
        }
      });
    } catch (e: any) {
      setRatStatus(`Error: ${e?.message || String(e)}`);
    }
  }, [ratUserCode]);

  const sendPromptOverRelay = useCallback(async (prompt: string) => {
    if (!ratRelayRef.current) { 
      alert('Connect RAT2E first'); 
      return; 
    }

    // Try ACP first, fallback to legacy JSON
    if (acpClientRef.current && acpClientRef.current.ready) {
      try {
        await acpClientRef.current.prompt([{ type: 'text', text: prompt }]);
        console.log('Sent prompt via ACP');
      } catch (error) {
        console.error('Failed to send ACP prompt:', error);
        // Fallback to legacy method
        ratRelayRef.current.sendJson({ type: 'send-prompt', prompt });
      }
    } else {
      // Legacy fallback
      ratRelayRef.current.sendJson({ type: 'send-prompt', prompt });
      console.log('Sent prompt via legacy method');
    }
  }, []);
  
  // Connection status - now based on ACP readiness
  const isConnected = acpClientRef.current?.ready || false;
  const sendMessage = (_msg: any) => {
    // Legacy sendMessage method - now routes through ACP if available
    if (acpClientRef.current?.ready) {
      console.log('Legacy sendMessage call - ACP is available');
    } else {
      console.log('Legacy sendMessage call - ACP not ready');
    }
  };
  const stopProcess = () => {};
  const { sendPrompt, clearMessages, activeSessionId, updateSessionMessages, sessions, createSession, switchSession, addMessage } = useClaudeStore();
  
  // Load directory from URL and history on mount
  useEffect(() => {
    loadDirectoryHistory();
    
    // Check if we should auto-start with the URL directory
    const hashDir = window.location.hash.slice(1);
    if (hashDir && hashDir.startsWith('/')) {
      const decodedDir = decodeURIComponent(hashDir);
      setDirectoryInput(decodedDir);
      setWorkingDirectory(decodedDir);
      // Save to history and load sessions
      saveDirectoryToHistory(decodedDir);
      loadAvailableSessions(decodedDir);
    }
    
    // Listen for hash changes (e.g., back/forward navigation)
    const handleHashChange = () => {
      const newHash = window.location.hash.slice(1);
      if (newHash && newHash.startsWith('/')) {
        const decodedDir = decodeURIComponent(newHash);
        setDirectoryInput(decodedDir);
        setWorkingDirectory(decodedDir);
        saveDirectoryToHistory(decodedDir);
        loadAvailableSessions(decodedDir);
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Listen for session ID updates from Claude
  useEffect(() => {
    const handleSessionIdUpdate = (event: CustomEvent) => {
      const { oldId, newId } = event.detail;
      console.log(`Handling session ID update from ${oldId} to ${newId}`);
      
      // Refresh the sessions list to get the updated session
      if (workingDirectory) {
        loadAvailableSessions(workingDirectory);
      }
      
      // Scroll tabs to the left to show newest sessions
      setTimeout(() => {
        if (tabsRef.current) {
          const scrollContainer = tabsRef.current.querySelector('.MuiTabs-scroller');
          if (scrollContainer) {
            scrollContainer.scrollLeft = 0; // Scroll to the far left (newest sessions)
          }
        }
      }, 100); // Small delay to ensure DOM is updated
    };
    
    window.addEventListener('session-id-updated', handleSessionIdUpdate as EventListener);
    return () => window.removeEventListener('session-id-updated', handleSessionIdUpdate as EventListener);
  }, [workingDirectory]);
  
  const loadDirectoryHistory = async () => {
    try {
      const response = await fetch('/api/directory-history');
      const data = await response.json();
      setDirectoryHistory(data.directories.map((d: any) => d.path));
    } catch (error) {
      console.error('Failed to load directory history:', error);
    }
  };
  
  const saveDirectoryToHistory = async (directory: string) => {
    try {
      await fetch('/api/directory-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: directory })
      });
      await loadDirectoryHistory();
    } catch (error) {
      console.error('Failed to save directory to history:', error);
    }
  };
  
  const handleDirectoryChange = (value: string) => {
    setDirectoryInput(value);
    
    // Clear existing timeout
    if (directoryTimeout.current) {
      clearTimeout(directoryTimeout.current);
    }
    
    // Set new timeout to update working directory after user stops typing
    directoryTimeout.current = setTimeout(() => {
      // Only reset the session flag if the directory actually changed
      if (workingDirectory !== value) {
        console.log('Directory changed from', workingDirectory, 'to', value);
        hasStartedSession.current = false;
        setWorkingDirectory(value);
        // Update URL hash with the new directory
        window.location.hash = encodeURIComponent(value);
        // Save to history
        saveDirectoryToHistory(value);
        // Load available sessions for this directory
        loadAvailableSessions(value);
      } else {
        console.log('Directory unchanged, not resetting session');
      }
    }, 500);
  };
  
  const loadAvailableSessions = async (directory: string) => {
    try {
      const response = await fetch(`/api/session-history?path=${encodeURIComponent(directory)}`);
      const data = await response.json();
      const sessions = data.sessions || [];
      setAvailableSessions(sessions);
      
      // Check if any session has a claudeSessionId that matches our activeSessionId
      // This handles the case where Claude changed our session ID
      const currentActiveId = useClaudeStore.getState().activeSessionId;
      if (currentActiveId) {
        const matchingSession = sessions.find((s: any) => 
          s.claudeSessionId === currentActiveId || s.id === currentActiveId
        );
        if (matchingSession && matchingSession.id !== currentActiveId) {
          console.log(`Found matching session with Claude ID: ${matchingSession.claudeSessionId}`);
          // The active session ID in our store matches a Claude session ID
          // No need to switch, just ensure tab selection works
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setAvailableSessions([]);
    }
  };
  
  const loadedSessionsRef = useRef<Set<string>>(new Set());
  
  const loadSessionHistory = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/session-history?path=${encodeURIComponent(workingDirectory)}&sessionId=${sessionId}`);
      const data = await response.json();
      
      // Process the messages and restore them to the UI
      if (data.messages && data.messages.length > 0) {
        const messages: any[] = [];
        
        // Load all raw JSON entries into the debug log
        const { addJsonDebug, clearJsonDebug } = useClaudeStore.getState();
        clearJsonDebug(); // Clear existing debug logs before loading new session
        data.messages.forEach((entry: any) => {
          addJsonDebug(entry);
        });
        
        // Parse and add messages from history
        data.messages.forEach((entry: any, index: number) => {
          // Handle our custom user prompt logging
          if (entry.type === 'user' && entry.prompt) {
            messages.push({ 
              id: `history-user-${index}-${Date.now()}`,
              type: 'user', 
              content: entry.prompt,
              timestamp: new Date(entry.timestamp).getTime()
            });
          } else if (entry.parsed) {
            const msg = entry.parsed;
            // Handle different message types from parsed JSON
            if (msg.type === 'user') {
              if (msg.prompt) {
                messages.push({ 
                  id: `history-user-${index}-${Date.now()}`,
                  type: 'user', 
                  content: msg.prompt,
                  timestamp: new Date(entry.timestamp).getTime()
                });
              } else if (msg.message?.content) {
                // Handle tool results in user messages
                const toolResults = msg.message.content.filter((c: any) => c.type === 'tool_result');
                toolResults.forEach((toolResult: any, toolIndex: number) => {
                  messages.push({
                    id: `history-tool-result-user-${index}-${toolIndex}-${Date.now()}`,
                    type: 'tool_result',
                    content: toolResult.content || 'Tool result',
                    timestamp: new Date(entry.timestamp).getTime()
                  });
                });
              }
            } else if (msg.type === 'assistant' && msg.message) {
              // Extract text content from assistant messages
              const textContent = msg.message.content
                ?.filter((c: any) => c.type === 'text')
                ?.map((c: any) => c.text)
                ?.join('') || '';
              if (textContent) {
                // Extract tokens from the usage field
                const tokens = msg.message.usage?.output_tokens || undefined;
                messages.push({ 
                  id: msg.id || `history-assistant-${index}-${Date.now()}`,
                  type: 'assistant', 
                  content: textContent,
                  tokens,
                  model: msg.message.model,
                  timestamp: new Date(entry.timestamp).getTime()
                });
              }
              // Also extract tool uses from assistant messages
              const toolUses = msg.message.content?.filter((c: any) => c.type === 'tool_use') || [];
              toolUses.forEach((toolUse: any, toolIndex: number) => {
                messages.push({
                  id: `history-tool-use-${index}-${toolIndex}-${Date.now()}`,
                  type: 'tool_use',
                  content: `Using tool: ${toolUse.name || 'Unknown'}`,
                  tool_name: toolUse.name,
                  tool_input: toolUse.input,
                  timestamp: new Date(entry.timestamp).getTime()
                });
              });
            } else if (msg.type === 'tool_use') {
              // Direct tool use messages
              messages.push({
                id: msg.id || `history-tool-use-${index}-${Date.now()}`,
                type: 'tool_use',
                content: msg.content || `Using tool: ${msg.tool_name || 'Unknown'}`,
                tool_name: msg.tool_name,
                tool_input: msg.tool_input,
                timestamp: new Date(entry.timestamp).getTime()
              });
            } else if (msg.type === 'tool_result') {
              // Tool result messages
              messages.push({
                id: msg.id || `history-tool-result-${index}-${Date.now()}`,
                type: 'tool_result',
                content: msg.content || msg.tool_result || 'Tool result',
                tool_name: msg.tool_name,
                timestamp: new Date(entry.timestamp).getTime()
              });
            } else if (msg.type === 'thinking') {
              // Thinking messages
              messages.push({
                id: msg.id || `history-thinking-${index}-${Date.now()}`,
                type: 'thinking',
                content: msg.content,
                timestamp: new Date(entry.timestamp).getTime()
              });
            } else if (msg.type === 'system') {
              // System messages (but skip init messages)
              if (msg.subtype !== 'init' && msg.content) {
                messages.push({
                  id: `history-system-${index}-${Date.now()}`,
                  type: 'system',
                  content: msg.content,
                  timestamp: new Date(entry.timestamp).getTime()
                });
              }
            }
          } else if (entry.message) {
            // Handle simple message format (from our own logging)
            if (entry.message.type && entry.message.content) {
              messages.push({
                id: entry.message.id || `history-${entry.message.type}-${index}-${Date.now()}`,
                type: entry.message.type,
                content: entry.message.content,
                tool_name: entry.message.tool_name,
                tool_input: entry.message.tool_input,
                tokens: entry.message.tokens,
                model: entry.message.model,
                timestamp: new Date(entry.timestamp || Date.now()).getTime()
              });
            }
          }
        });
        
        // Sort messages by timestamp to ensure proper order
        messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        console.log(`Loaded ${messages.length} messages from session history`);
        console.log('Message types:', messages.map(m => m.type));
        
        // Switch to this session and mark it as active WITHOUT clearing messages
        const { switchSession, updateSessionMessages, setSessionActive } = useClaudeStore.getState();
        switchSession(sessionId);
        updateSessionMessages(sessionId, messages);
        setSessionActive(true); // Mark session as active without clearing
        
        // Only tell backend to resume if we haven't already loaded this session
        if (!loadedSessionsRef.current.has(sessionId)) {
          console.log('Resuming session in backend:', sessionId);
          loadedSessionsRef.current.add(sessionId);
          sendMessage({
            type: 'start-session',
            workingDirectory: workingDirectory,
            sessionId: sessionId  // Pass the Claude session ID to resume
          });
        } else {
          console.log('Session already loaded in backend, just switching UI:', sessionId);
        }
      }
    } catch (error) {
      console.error('Failed to load session history:', error);
    }
  };

  // Auto-start session when connected and directory is set
  useEffect(() => {
    // Skip if not connected or no working directory
    if (!isConnected || !workingDirectory) return;
    
    // Skip if we've already started a session for this directory
    if (hasStartedSession.current) {
      console.log('Session already started for this directory, skipping');
      return;
    }
    
    // Get current state from the store
    const state = useClaudeStore.getState();
    const currentSessionActive = state.sessionActive;
    const currentActiveSessionId = state.activeSessionId;
    
    console.log('Session effect checking:', {
      isConnected,
      workingDirectory,
      currentSessionActive,
      currentActiveSessionId,
      hasStartedSession: hasStartedSession.current
    });
    
    if (!currentSessionActive && !currentActiveSessionId) {
      // Start new session if we don't have one - but with proper UUID
      console.log('Auto-starting new session for directory:', workingDirectory);
      
      // Generate a proper UUID v4
      const newSessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      
      hasStartedSession.current = true;
      const { createSession, startSession } = useClaudeStore.getState();
      createSession(newSessionId);
      startSession(workingDirectory);
      sendMessage({
        type: 'start-session',
        workingDirectory: workingDirectory,
        sessionId: newSessionId,
        isNewSession: true  // Tell backend this is a new session, not a resume
      });
      
      // Refresh sessions after a delay
      setTimeout(() => {
        loadAvailableSessions(workingDirectory);
      }, 1000);
    } else if (currentSessionActive && currentActiveSessionId) {
      // Re-establish existing session after reconnection only if not already loaded
      if (!loadedSessionsRef.current.has(currentActiveSessionId)) {
        console.log('Re-establishing session after reconnection:', currentActiveSessionId);
        hasStartedSession.current = true;
        loadedSessionsRef.current.add(currentActiveSessionId);
        sendMessage({
          type: 'start-session',
          workingDirectory: workingDirectory,
          sessionId: currentActiveSessionId
        });
      } else {
        console.log('Session already established, skipping re-establishment:', currentActiveSessionId);
        hasStartedSession.current = true;
      }
    }
  }, [isConnected, workingDirectory, sendMessage]); // Only depend on connection and directory changes
  
  const handleSendPrompt = useCallback(async (prompt: string, markdownFiles?: string[]) => {
    console.log('handleSendPrompt called with:', prompt);
    console.log('Markdown files:', markdownFiles);
    
    let finalPrompt = prompt;
    
    // If markdown files are selected, load and prepend them as system content
    if (markdownFiles && markdownFiles.length > 0) {
      try {
        const response = await fetch('/api/markdown-content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ files: markdownFiles })
        });
        
        if (response.ok) {
          const contents = await response.json();
          
          // Build system prompt from markdown files
          const systemPrompt = contents.map((file: any) => {
            if (file.error) {
              return `# Error loading ${file.name}: ${file.error}`;
            }
            return `# System Instructions from ${file.name}\n\n${file.content}`;
          }).join('\n\n---\n\n');
          
          // Prepend system prompt to the user's message
          finalPrompt = `<system>\n${systemPrompt}\n</system>\n\n${prompt}`;
          
          // Log the markdown file usage
          console.log('Included markdown files as system prompt:', markdownFiles);
          
          // Add a note in the UI that we included system files
          const systemNote = {
            id: `system-md-${Date.now()}`,
            type: 'system' as const,
            content: `📎 Included ${markdownFiles.length} markdown file(s) as system instructions: ${markdownFiles.map(f => f.split('/').pop()).join(', ')}`,
            timestamp: Date.now()
          };
          addMessage(systemNote);
        }
      } catch (error) {
        console.error('Failed to load markdown files:', error);
      }
    }
    
    sendPrompt(finalPrompt);
    // Route prompt through RAT2E relay (ACP over tunnel to be wired)
    sendPromptOverRelay(finalPrompt);
    
    // Refresh sessions list after sending a message to update timestamps
    if (workingDirectory) {
      setTimeout(() => {
        loadAvailableSessions(workingDirectory);
      }, 1000);
    }
  }, [sendPrompt, workingDirectory, addMessage, sendPromptOverRelay]);

  const handleCompactConversation = useCallback(async () => {
    if (!activeSessionId || !workingDirectory) return;
    
    console.log('Starting conversation compaction...');
    
    // Create a new session for the compacted conversation
    const newSessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    
    // Copy current session messages to the new session
    const currentMessages = sessions[activeSessionId]?.messages || [];
    
    // Create new session and switch to it
    createSession(newSessionId);
    updateSessionMessages(newSessionId, currentMessages);
    switchSession(newSessionId);
    
    // Add a status message that we're compacting
    const compactingMessage = {
      id: `compact-${Date.now()}`,
      type: 'system' as const,
      content: '⏳ Compacting conversation history... This may take up to 3 minutes.',
      timestamp: Date.now()
    };
    addMessage(compactingMessage);
    
    try {
      // Call the backend to run shadow summarization
      const response = await fetch('/api/compact-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: activeSessionId, // Use the old session ID to load its history
          workingDirectory
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to compact conversation');
      }
      
      const { summary } = await response.json();
      
      // Remove the compacting message
      const { messages } = useClaudeStore.getState().sessions[newSessionId] || { messages: [] };
      const updatedMessages = messages.filter(m => m.id !== compactingMessage.id);
      updateSessionMessages(newSessionId, updatedMessages);
      
      // Add a success message
      const successMessage = {
        id: `compact-success-${Date.now()}`,
        type: 'system' as const, 
        content: '✅ Conversation compacted! The summary has been added to the message box below. You can edit it before sending.',
        timestamp: Date.now()
      };
      addMessage(successMessage);
      
      // Set the summary in the input field by finding and updating the ChatInterface
      // We'll need to pass this through props or use a ref
      // For now, let's add it to the store so ChatInterface can pick it up
      const { setPendingInput } = useClaudeStore.getState();
      setPendingInput(summary);
      
      // Start the new session in the backend
      sendMessage({
        type: 'start-session',
        workingDirectory: workingDirectory,
        sessionId: newSessionId,
        isNewSession: true
      });
      
      // Refresh sessions list
      setTimeout(() => {
        loadAvailableSessions(workingDirectory);
      }, 1000);
      
    } catch (error: any) {
      console.error('Failed to compact conversation:', error);
      
      // Remove the compacting message and add error message
      const { messages } = useClaudeStore.getState().sessions[newSessionId] || { messages: [] };
      const updatedMessages = messages.filter(m => m.id !== compactingMessage.id);
      updateSessionMessages(newSessionId, updatedMessages);
      
      const errorDetail = error.message || 'Unknown error occurred';
      const errorMessage = {
        id: `compact-error-${Date.now()}`,
        type: 'system' as const,
        content: `❌ Failed to compact conversation: ${errorDetail}\n\nTry reducing the conversation size or restarting the application.`,
        timestamp: Date.now()
      };
      addMessage(errorMessage);
      
      // Switch back to the original session on error
      switchSession(activeSessionId);
    }
  }, [activeSessionId, workingDirectory, sessions, createSession, updateSessionMessages, switchSession, addMessage, sendMessage]);
  
  const handleLoadJsonSession = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const jsonData = JSON.parse(`[${text.split('\n').filter(line => line.trim()).join(',')}]`);
      
      // Load the raw JSON data into the debug log
      const { addJsonDebug } = useClaudeStore.getState();
      jsonData.forEach((entry: any) => {
        addJsonDebug(entry);
      });
      
      const response = await fetch('/api/load-json-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonData, sessionId: activeSessionId })
      });
      
      const result = await response.json();
      if (result.success && result.messages) {
        // Merge the messages into the current session
        const currentMessages = useClaudeStore.getState().messages;
        const mergedMessages = [...result.messages, ...currentMessages];
        updateSessionMessages(activeSessionId || 'default', mergedMessages);
        
        alert(`Loaded ${result.messageCount} messages and ${jsonData.length} JSON entries from session`);
      }
    } catch (error) {
      console.error('Failed to load JSON session:', error);
      alert('Failed to load JSON session. Make sure the file is valid.');
    }
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Hidden file input for JSON upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleLoadJsonSession}
      />
      
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ mr: 2 }}>
            claude_code_web
          </Typography>
          {/* RAT2E quick connect (MVP) */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 2 }}>
            <TextField size="small" label="RAT2E Code" variant="outlined" value={ratUserCode} onChange={(e) => setRatUserCode(e.target.value)} />
            <Button variant="contained" color="secondary" onClick={connectRat2e}>Connect</Button>
            {ratStatus && (
              <Chip size="small" label={`RAT2E: ${ratStatus}`} color={ratStatus === 'Connected' ? 'success' as any : 'default'} />
            )}
          </Box>
          
          {/* Session Tabs */}
          {workingDirectory && (
            <Box ref={tabsRef} sx={{ 
              flexGrow: 1, 
              display: 'flex', 
              alignItems: 'center',
              minWidth: 0, // Allow shrinking
              overflow: 'hidden', // Prevent overflow
              mx: 2 // Add margin for spacing
            }}>
              <Tabs
                value={(() => {
                  // First check if activeSessionId directly matches any session.id
                  if (availableSessions.some(s => s.id === activeSessionId)) {
                    return activeSessionId;
                  }
                  // Then check if activeSessionId matches any session's claudeSessionId
                  const matchingSession = availableSessions.find(s => s.claudeSessionId === activeSessionId);
                  if (matchingSession) {
                    return matchingSession.id;
                  }
                  // Fallback to first session if available
                  return availableSessions.length > 0 ? availableSessions[0].id : false;
                })()}
                onChange={(_, value) => {
                  if (value === 'new') {
                    // Generate a proper UUID v4
                    const newSessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                      const r = Math.random() * 16 | 0;
                      const v = c === 'x' ? r : (r & 0x3 | 0x8);
                      return v.toString(16);
                    });
                    console.log('Creating new session with UUID:', newSessionId);
                    const { createSession, startSession } = useClaudeStore.getState();
                    createSession(newSessionId);
                    startSession(workingDirectory);
                    
                    // Start the session in the backend
                    sendMessage({
                      type: 'start-session',
                      workingDirectory: workingDirectory,
                      sessionId: newSessionId,
                      isNewSession: true  // Tell backend this is a new session, not a resume
                    });
                    
                    hasStartedSession.current = true; // Mark as started to prevent auto-start
                    
                    // Refresh sessions list after a delay
                    setTimeout(() => {
                      loadAvailableSessions(workingDirectory);
                    }, 1000);
                  } else if (value) {
                    loadSessionHistory(value);
                    hasStartedSession.current = true; // Mark as started when loading existing session
                  }
                }}
                variant="scrollable"
                scrollButtons
                allowScrollButtonsMobile
                sx={{
                  width: '100%',
                  '& .MuiTabs-scroller': {
                    overflow: 'hidden !important', // Hide scrollbar
                  },
                  '& .MuiTabs-indicator': {
                    backgroundColor: '#00ffff',
                    height: 2,
                    boxShadow: '0 0 10px #00ffff',
                  },
                  '& .MuiTabs-scrollButtons': {
                    color: '#00ffff',
                    '&.Mui-disabled': {
                      opacity: 0.3,
                    },
                  },
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    minHeight: 40,
                    minWidth: 100,
                    maxWidth: 150,
                    fontSize: '0.85rem',
                    padding: '6px 12px',
                    color: 'text.secondary',
                    borderRight: '1px solid rgba(0, 255, 255, 0.15)',
                    '&.Mui-selected': {
                      color: '#00ffff',
                      backgroundColor: 'rgba(0, 255, 255, 0.05)',
                      textShadow: '0 0 5px #00ffff',
                    },
                  },
                }}
              >
                {availableSessions
                  .sort((a, b) => {
                    // Sort by last timestamp, newest first (descending)
                    const timeA = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
                    const timeB = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
                    return timeB - timeA;
                  })
                  .map(session => {
                  const lastTime = session.lastTimestamp 
                    ? new Date(session.lastTimestamp).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '';
                  // Use Claude's session ID as the display name and value
                  const displayId = session.claudeSessionId || session.id;
                  const truncatedId = displayId.length > 12 ? 
                    `${displayId.substring(0, 6)}...${displayId.substring(displayId.length - 4)}` : 
                    displayId.substring(0, 12);
                  
                  // Check if this session is processing
                  const isProcessing = sessions[session.id]?.processing || false;
                  
                  return (
                    <Tab
                      key={session.id}
                      value={session.id}
                      label={
                        <Box sx={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          py: 0.5
                        }}>
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 0.5,
                            width: '100%'
                          }}>
                            <Typography 
                              variant="caption" 
                              title={displayId}
                              sx={{ 
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {truncatedId}
                            </Typography>
                            {isProcessing && (
                              <CircularProgress 
                                size={8} 
                                thickness={6}
                                sx={{ 
                                  color: '#00ffff',
                                  flexShrink: 0
                                }}
                              />
                            )}
                          </Box>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              fontSize: '0.65rem',
                              opacity: 0.7,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {lastTime} • {session.messageCount || 0} msgs
                          </Typography>
                        </Box>
                      }
                    />
                  );
                })}
                <Tab
                  value="new"
                  icon={<AddIcon fontSize="small" />}
                  iconPosition="start"
                  label="New"
                  sx={{
                    minWidth: 80,
                    borderRight: 'none',
                  }}
                />
              </Tabs>
            </Box>
          )}
          
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip 
              label={acpClientRef.current?.ready ? "ACP: Ready" : "Backend: ACP"} 
              color={acpClientRef.current?.ready ? "success" : "default"} 
              size="small" 
            />
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
              <MenuItem onClick={() => {
                fileInputRef.current?.click();
                setMenuAnchor(null);
              }}>
                <UploadIcon sx={{ mr: 1 }} fontSize="small" />
                Load JSON Session
              </MenuItem>
              <MenuItem onClick={() => {
                clearMessages();
                setMenuAnchor(null);
              }}>
                <ClearIcon sx={{ mr: 1 }} fontSize="small" />
                Clear Chat
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Drawer
        variant="persistent"
        anchor="left"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          transition: 'width 0.3s',
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            marginTop: '64px'
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ flexShrink: 0 }}>
            <List>
              <ListItem>
                <Typography variant="subtitle2" color="text.secondary">
                  Working Directory
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setDirectorySelectionMode(!directorySelectionMode)}
                  sx={{ ml: 'auto' }}
                  title={directorySelectionMode ? "Switch to file mode" : "Browse directories"}
                >
                  <FolderOpenIcon fontSize="small" />
                </IconButton>
              </ListItem>
              <ListItem>
                <Autocomplete
                  fullWidth
                  size="small"
                  value={directoryInput}
                  onChange={(_, newValue) => {
                    if (newValue) {
                      setDirectoryInput(newValue);
                      handleDirectoryChange(newValue);
                    }
                  }}
                  inputValue={directoryInput}
                  onInputChange={(_, newInputValue) => {
                    setDirectoryInput(newInputValue);
                  }}
                  options={directoryHistory}
                  freeSolo
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="/path/to/your/project"
                      helperText={workingDirectory ? `Active: ${workingDirectory}` : directorySelectionMode ? "Browse and click a directory below to select" : "Enter path or browse directories"}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {params.InputProps.endAdornment}
                            {!workingDirectory && (
                              <Button
                                size="small"
                                onClick={() => handleDirectoryChange(directoryInput)}
                                variant="contained"
                                disabled={!directoryInput}
                              >
                                Select
                              </Button>
                            )}
                          </>
                        )
                      }}
                    />
                  )}
                />
              </ListItem>
            </List>
            <Divider />
          </Box>
          
          <Box sx={{ flexGrow: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flexGrow: 1, overflow: 'auto', minHeight: 0 }}>
              <FileExplorer 
                rootPath={workingDirectory || (directorySelectionMode ? (directoryInput || '/home') : '/home')}
                mode={directorySelectionMode ? 'directories' : 'files'}
                onFileSelect={(path) => {
                  // Add @file reference to selected files
                  if (!selectedFiles.includes(path)) {
                    setSelectedFiles([...selectedFiles, path]);
                  }
                }}
                onDirectorySelect={(path) => {
                  setDirectoryInput(path);
                  // Don't auto-start, let user click Select
                }}
              />
            </Box>
          </Box>
          
          <ResizablePanel
            minHeight={150}
            defaultHeight={250}
          >
            <TodoPanel />
          </ResizablePanel>
        </Box>
      </Drawer>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          marginTop: '64px',
          marginLeft: 0,
          width: drawerOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
          transition: 'width 0.3s',
          backgroundColor: '#000000',
          height: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'absolute',
          right: 0
        }}
      >
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Button
                  onClick={() => setSelectedTab('chat')}
                  sx={{
                    color: selectedTab === 'chat' ? 'primary.main' : 'text.secondary',
                    borderBottom: selectedTab === 'chat' ? '2px solid' : 'none',
                    borderRadius: 0
                  }}
                >
                  Chat
                </Button>
                <Button
                  onClick={() => setSelectedTab('editor')}
                  sx={{
                    color: selectedTab === 'editor' ? 'primary.main' : 'text.secondary',
                    borderBottom: selectedTab === 'editor' ? '2px solid' : 'none',
                    borderRadius: 0
                  }}
                >
                  Code Editor
                </Button>
                <Button
                  onClick={() => setSelectedTab('hooks')}
                  sx={{
                    color: selectedTab === 'hooks' ? 'primary.main' : 'text.secondary',
                    borderBottom: selectedTab === 'hooks' ? '2px solid' : 'none',
                    borderRadius: 0
                  }}
                >
                  Hooks Monitor
                </Button>
                <Button
                  onClick={() => setSelectedTab('json')}
                  sx={{
                    color: selectedTab === 'json' ? 'primary.main' : 'text.secondary',
                    borderBottom: selectedTab === 'json' ? '2px solid' : 'none',
                    borderRadius: 0
                  }}
                >
                  JSON Debug
                </Button>
              </Box>
              
              <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                {selectedTab === 'chat' && (
                  <ChatInterface
                    onSendMessage={handleSendPrompt}
                    onStopProcess={stopProcess}
                    onCompactConversation={handleCompactConversation}
                    disabled={false}
                    selectedFiles={selectedFiles}
                    onClearFiles={() => setSelectedFiles([])}
                    workingDirectory={workingDirectory}
                  />
                )}
                {selectedTab === 'editor' && (
                  <CodeEditor
                    selectedFiles={selectedFiles}
                    onCloseEditor={() => setSelectedTab('chat')}
                    workingDirectory={workingDirectory}
                  />
                )}
                {selectedTab === 'hooks' && (
                  <HookEventMonitor />
                )}
                {selectedTab === 'json' && (
                  <JsonDebugViewer />
                )}
              </Box>
      </Box>
    </Box>
  );
}

export default App;
