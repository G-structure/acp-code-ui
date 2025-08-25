import { useEffect, useState, useRef } from 'react';
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
import { useWebSocket } from './hooks/useWebSocket';
import { useClaudeStore } from './store/claudeStore';

const DRAWER_WIDTH = 360;

function App() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'chat' | 'terminal' | 'hooks' | 'json'>('chat');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const defaultDir = window.location.pathname.startsWith('/home') ? window.location.pathname : '/tmp';
  const [directoryInput, setDirectoryInput] = useState(defaultDir);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [availableSessions, setAvailableSessions] = useState<any[]>([]);
  const [directoryHistory, setDirectoryHistory] = useState<string[]>([]);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [directorySelectionMode, setDirectorySelectionMode] = useState(false);
  const directoryTimeout = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { isConnected, sendMessage } = useWebSocket();
  const { sessionActive, startSession, sendPrompt, clearMessages, activeSessionId, updateSessionMessages } = useClaudeStore();
  
  // Load directory history on mount
  useEffect(() => {
    loadDirectoryHistory();
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
      setWorkingDirectory(value);
      // Save to history
      saveDirectoryToHistory(value);
      // Load available sessions for this directory
      loadAvailableSessions(value);
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
        
        // Switch to this session
        const { switchSession, updateSessionMessages } = useClaudeStore.getState();
        switchSession(sessionId);
        updateSessionMessages(sessionId, messages);
      }
    } catch (error) {
      console.error('Failed to load session history:', error);
    }
  };

  // Auto-start session when connected and directory is set
  useEffect(() => {
    if (isConnected && !sessionActive && workingDirectory) {
      startSession(workingDirectory);
      sendMessage({
        type: 'start-session',
        workingDirectory: workingDirectory
      });
    }
  }, [isConnected, sessionActive, workingDirectory]);
  
  const handleSendPrompt = (prompt: string) => {
    sendPrompt(prompt);
    sendMessage({
      type: 'send-prompt',
      prompt
    });
  };
  
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
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
              <Tabs
                value={activeSessionId || false}
                onChange={(_, value) => {
                  if (value === 'new') {
                    const newSessionId = `session-${Date.now()}`;
                    const { createSession } = useClaudeStore.getState();
                    createSession(newSessionId);
                  } else if (value) {
                    loadSessionHistory(value);
                  }
                }}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  '& .MuiTabs-indicator': {
                    backgroundColor: '#00ffff',
                    height: 2,
                    boxShadow: '0 0 10px #00ffff',
                  },
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    minHeight: 40,
                    minWidth: 120,
                    fontSize: '0.875rem',
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
                {availableSessions.map(session => {
                  const lastTime = session.lastTimestamp 
                    ? new Date(session.lastTimestamp).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '';
                  return (
                    <Tab
                      key={session.id}
                      value={session.id}
                      label={
                        <Box sx={{ textAlign: 'left' }}>
                          <Typography variant="body2">
                            {session.id.substring(0, 8)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
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
          
          <Box sx={{ flexShrink: 0, minHeight: 200, maxHeight: '50%', borderTop: '1px solid rgba(0,255,255,0.15)', p: 1, overflow: 'auto' }}>
            <TodoPanel />
          </Box>
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