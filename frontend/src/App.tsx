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
import { useWebSocket } from './hooks/useWebSocket';
import { useClaudeStore } from './store/claudeStore';

const DRAWER_WIDTH = 360;

function App() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'chat' | 'terminal' | 'hooks' | 'json'>('chat');
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
  
  const { isConnected, sendMessage, stopProcess } = useWebSocket(() => {
    // Refresh sessions list when Claude is ready (finished processing)
    if (workingDirectory) {
      loadAvailableSessions(workingDirectory);
    }
  });
  const { sessionActive, startSession, sendPrompt, clearMessages, activeSessionId, updateSessionMessages, sessions } = useClaudeStore();
  
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
      setAvailableSessions(data.sessions || []);
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
        data.messages.forEach((entry: any) => {
          // Handle our custom user prompt logging
          if (entry.type === 'user' && entry.prompt) {
            messages.push({ 
              id: `msg-${Date.now()}-${Math.random()}`,
              type: 'user', 
              content: entry.prompt,
              timestamp: new Date(entry.timestamp).getTime()
            });
          } else if (entry.parsed) {
            const msg = entry.parsed;
            // Handle user messages from the parsed JSON (less common)
            if (msg.type === 'user' && msg.prompt) {
              messages.push({ 
                id: `msg-${Date.now()}-${Math.random()}`,
                type: 'user', 
                content: msg.prompt,
                timestamp: new Date(entry.timestamp).getTime()
              });
            } else if (msg.type === 'assistant' && msg.message) {
              const textContent = msg.message.content
                ?.filter((c: any) => c.type === 'text')
                ?.map((c: any) => c.text)
                ?.join('') || '';
              if (textContent) {
                // Extract tokens from the usage field
                const tokens = msg.message.usage?.output_tokens || undefined;
                messages.push({ 
                  id: `msg-${Date.now()}-${Math.random()}`,
                  type: 'assistant', 
                  content: textContent,
                  tokens,
                  model: msg.message.model,
                  timestamp: new Date(entry.timestamp).getTime()
                });
              }
            }
          }
        });
        
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
  
  const handleSendPrompt = useCallback((prompt: string) => {
    console.log('handleSendPrompt called with:', prompt);
    sendPrompt(prompt);
    sendMessage({
      type: 'send-prompt',
      prompt
    });
    
    // Refresh sessions list after sending a message to update timestamps
    if (workingDirectory) {
      setTimeout(() => {
        loadAvailableSessions(workingDirectory);
      }, 1000);
    }
  }, [sendPrompt, sendMessage, workingDirectory]);
  
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
          <Typography variant="h7" noWrap component="div" sx={{ mr: 2 }}>
            claude_code_web
          </Typography>
          
          {/* Session Tabs */}
          {workingDirectory && (
            <Box sx={{ 
              flexGrow: 1, 
              display: 'flex', 
              alignItems: 'center',
              minWidth: 0, // Allow shrinking
              overflow: 'hidden', // Prevent overflow
              mx: 2 // Add margin for spacing
            }}>
              <Tabs
                value={availableSessions.some(s => s.id === activeSessionId) ? activeSessionId : (availableSessions.length > 0 ? availableSessions[0].id : false)}
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
            {isConnected ? (
              <Chip label="Connected" color="success" size="small" />
            ) : (
              <Chip label="Disconnected" color="error" size="small" />
            )}
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
                    disabled={false}
                    selectedFiles={selectedFiles}
                    onClearFiles={() => setSelectedFiles([])}
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