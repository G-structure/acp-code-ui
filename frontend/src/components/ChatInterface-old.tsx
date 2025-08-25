import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  CircularProgress,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  List,
  ListItem
} from '@mui/material';
import {
  Send as SendIcon,
  Clear as ClearIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
  Build as BuildIcon,
  Psychology as PsychologyIcon,
  Code as CodeIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Stop as StopIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { cyberpunkCodeTheme } from '../theme/cyberpunkCodeTheme';
import { useClaudeStore } from '../store/claudeStore';
import { useVoiceInput } from '../hooks/useVoiceInput';
import ToolResultBlock from './ToolResultBlock';

interface ChatInterfaceProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  selectedFiles?: string[];
  onClearFiles?: () => void;
}

// Memoized message row component
const MessageRow = memo(({ index, style, data }: any) => {
  const message = data.messages[index];
  const { getMessageIcon, getMessageColor, getMessageBorder } = data;
  
  return (
    <div style={style}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          mb: 2,
          px: 2,
          flexDirection: message.type === 'user' ? 'row-reverse' : 'row'
        }}
      >
        <Box
          sx={{
            mr: message.type === 'user' ? 0 : 1,
            ml: message.type === 'user' ? 1 : 0
          }}
        >
          {getMessageIcon(message.type)}
        </Box>
        <Paper
          elevation={1}
          sx={{
            p: 2,
            maxWidth: '70%',
            backgroundColor: getMessageColor(message.type),
            border: getMessageBorder(message.type),
            boxShadow: message.type === 'user' ? '0 0 20px rgba(0, 255, 255, 0.1)' : '0 0 20px rgba(255, 0, 255, 0.08)'
          }}
        >
          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              label={
                message.type === 'user' ? 'You' : 
                message.type === 'assistant' ? 'Claude' :
                message.type === 'thinking' ? 'Thinking' :
                message.type === 'tool_use' ? `Tool: ${message.tool_name || 'Unknown'}` :
                message.type === 'tool_result' ? 'Result' :
                message.type
              }
              size="small"
              color={message.type === 'user' ? 'primary' : 'secondary'}
            />
            <Typography variant="caption" color="text.secondary">
              {new Date(message.timestamp).toLocaleTimeString()}
            </Typography>
            {message.tokens && (
              <Typography variant="caption" color="text.secondary">
                • {message.tokens} tokens
              </Typography>
            )}
          </Box>
          {message.type === 'tool_result' ? (
            <ToolResultBlock content={message.content} />
          ) : (
            <ReactMarkdown
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={cyberpunkCodeTheme}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        background: '#0a0a0a',
                        border: '1px solid rgba(0, 255, 255, 0.2)',
                        borderRadius: '4px',
                        padding: '12px',
                        boxShadow: 'inset 0 0 20px rgba(0, 255, 255, 0.05)',
                      }}
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code 
                      className={className} 
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        color: '#00ffff',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        border: '1px solid rgba(0, 255, 255, 0.2)',
                        fontSize: '0.9em',
                        fontFamily: '"Fira Code", "Courier New", monospace',
                        textShadow: '0 0 2px rgba(0, 255, 255, 0.3)'
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </Paper>
      </Box>
    </div>
  );
});

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onSendMessage, disabled, selectedFiles = [], onClearFiles }) => {
  const [input, setInput] = useState('');
  const [messageFilters, setMessageFilters] = useState<string[]>(['user', 'assistant']);
  const [voiceError, setVoiceError] = useState<string>('');
  const listRef = useRef<any>(null);
  const rowHeights = useRef<{ [key: string]: number }>({});
  const { messages, processing, clearMessages, totalTokens, model } = useClaudeStore();
  
  const { isRecording, isTranscribing, voiceEnabled, toggleRecording } = useVoiceInput({
    onTranscription: (text) => {
      // Append transcribed text to existing input
      setInput(prev => prev ? `${prev} ${text}` : text);
      setVoiceError('');
    },
    onError: (error) => {
      setVoiceError(error);
      setTimeout(() => setVoiceError(''), 10000); // Clear error after 10 seconds
    }
  });

  // Get estimated item size for virtualization
  const getItemSize = useCallback((index: number) => {
    // Return cached height if available, otherwise estimate
    const messageId = filteredMessages[index]?.id;
    return rowHeights.current[messageId] || 200; // Default estimate
  }, [filteredMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current && filteredMessages.length > 0) {
      listRef.current.scrollToItem(filteredMessages.length - 1, 'end');
    }
  }, [filteredMessages.length]);

  const handleSend = () => {
    if (input.trim() && !disabled && !processing) {
      // Add file references to the message
      let messageWithFiles = input;
      if (selectedFiles.length > 0) {
        const fileRefs = selectedFiles.map(f => `@${f}`).join(' ');
        messageWithFiles = `${fileRefs} ${input}`;
      }
      onSendMessage(messageWithFiles);
      setInput('');
      onClearFiles?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter will naturally create a new line
  };

  const handleFilterChange = (_event: React.MouseEvent<HTMLElement>, newFilters: string[]) => {
    if (newFilters.length > 0) {
      setMessageFilters(newFilters);
    }
  };

  const filteredMessages = messages
    .filter(msg => messageFilters.includes(msg.type))
    .sort((a, b) => a.timestamp - b.timestamp);

  const getMessageIcon = (type: string) => {
    switch(type) {
      case 'user': return <PersonIcon color="primary" />;
      case 'assistant': return <BotIcon color="secondary" />;
      case 'thinking': return <PsychologyIcon sx={{ color: '#ffaa00' }} />;
      case 'tool_use': return <BuildIcon sx={{ color: '#00ff88' }} />;
      case 'tool_result': return <CodeIcon sx={{ color: '#00aaff' }} />;
      default: return <BotIcon color="secondary" />;
    }
  };

  const getMessageColor = (type: string) => {
    switch(type) {
      case 'user': return 'rgba(0, 255, 255, 0.05)';
      case 'assistant': return 'rgba(255, 0, 255, 0.03)';
      case 'thinking': return 'rgba(255, 170, 0, 0.03)';
      case 'tool_use': return 'rgba(0, 255, 136, 0.03)';
      case 'tool_result': return 'rgba(0, 170, 255, 0.03)';
      default: return 'rgba(255, 0, 255, 0.03)';
    }
  };

  const getMessageBorder = (type: string) => {
    switch(type) {
      case 'user': return '1px solid rgba(0, 255, 255, 0.2)';
      case 'assistant': return '1px solid rgba(255, 0, 255, 0.15)';
      case 'thinking': return '1px solid rgba(255, 170, 0, 0.15)';
      case 'tool_use': return '1px solid rgba(0, 255, 136, 0.15)';
      case 'tool_result': return '1px solid rgba(0, 170, 255, 0.15)';
      default: return '1px solid rgba(255, 0, 255, 0.15)';
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#000000' }}>
      <Box sx={{ p: 1, borderBottom: '1px solid rgba(0,255,255,0.15)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
            ☠️ dangerous mode always enabled! ☠️
            </Typography>
            {model && (
              <Chip label={model} size="small" variant="outlined" color="default" />
            )}
            {totalTokens > 0 && (
              <Chip 
                label={`${totalTokens.toLocaleString()} tokens`} 
                size="small" 
                variant="outlined" 
                color={totalTokens > 150000 ? 'warning' : 'default'}
                title="Total tokens used in context"
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ToggleButtonGroup
              value={messageFilters}
              onChange={handleFilterChange}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  padding: '2px 8px',
                  fontSize: '0.7rem',
                  borderColor: 'rgba(0, 255, 255, 0.2)',
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(0, 255, 255, 0.1)',
                    borderColor: '#00ffff',
                  }
                }
              }}
            >
              <ToggleButton value="user" title="User messages">
                <PersonIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="assistant" title="Assistant messages">
                <BotIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="thinking" title="Thinking messages">
                <PsychologyIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="tool_use" title="Tool usage">
                <BuildIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="tool_result" title="Tool results">
                <CodeIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
            <IconButton size="small" onClick={clearMessages} disabled={processing}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Box>
      
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <AutoSizer>
          {({ height, width }) => (
            <VariableSizeList
              ref={listRef}
              height={height}
              width={width}
              itemCount={filteredMessages.length + (processing ? 1 : 0)}
              itemSize={getItemSize}
              itemData={{
                messages: processing 
                  ? [...filteredMessages, { id: 'processing', type: 'processing', content: '', timestamp: Date.now() }]
                  : filteredMessages,
                getMessageIcon,
                getMessageColor,
                getMessageBorder
              }}
              overscanCount={2}
            >
              {({ index, style, data }) => {
                const message = data.messages[index];
                if (message.type === 'processing') {
                  return (
                    <div style={style}>
                      <Box sx={{ display: 'flex', alignItems: 'center', px: 2 }}>
                        <BotIcon color="secondary" sx={{ mr: 1 }} />
                        <CircularProgress size={20} />
                        <Typography sx={{ ml: 2 }} color="text.secondary">
                          Claude is thinking...
                        </Typography>
                      </Box>
                    </div>
                  );
                }
                return <MessageRow index={index} style={style} data={data} />;
              }}
            </VariableSizeList>
          )}
        </AutoSizer>
      </Box>
      
      <Box sx={{ p: 2, borderTop: '1px solid rgba(0,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        {selectedFiles.length > 0 && (
                flexDirection: message.type === 'user' ? 'row-reverse' : 'row'
              }}
            >
              <Box
                sx={{
                  mr: message.type === 'user' ? 0 : 1,
                  ml: message.type === 'user' ? 1 : 0
                }}
              >
                {getMessageIcon(message.type)}
              </Box>
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  maxWidth: '70%',
                  backgroundColor: getMessageColor(message.type),
                  border: getMessageBorder(message.type),
                  boxShadow: message.type === 'user' ? '0 0 20px rgba(0, 255, 255, 0.1)' : '0 0 20px rgba(255, 0, 255, 0.08)'
                }}
              >
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Chip
                    label={
                      message.type === 'user' ? 'You' : 
                      message.type === 'assistant' ? 'Claude' :
                      message.type === 'thinking' ? 'Thinking' :
                      message.type === 'tool_use' ? `Tool: ${message.tool_name || 'Unknown'}` :
                      message.type === 'tool_result' ? 'Result' :
                      message.type
                    }
                    size="small"
                    color={message.type === 'user' ? 'primary' : 'secondary'}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </Typography>
                  {message.tokens && (
                    <Typography variant="caption" color="text.secondary">
                      • {message.tokens} tokens
                    </Typography>
                  )}
                </Box>
                {message.type === 'tool_result' ? (
                  <ToolResultBlock content={message.content} />
                ) : (
                  <ReactMarkdown
                    components={{
                      code({ inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={cyberpunkCodeTheme}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{
                              background: '#0a0a0a',
                              border: '1px solid rgba(0, 255, 255, 0.2)',
                              borderRadius: '4px',
                              padding: '12px',
                              boxShadow: 'inset 0 0 20px rgba(0, 255, 255, 0.05)',
                            }}
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code 
                            className={className} 
                            style={{
                              backgroundColor: 'rgba(0, 0, 0, 0.5)',
                              color: '#00ffff',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              border: '1px solid rgba(0, 255, 255, 0.2)',
                              fontSize: '0.9em',
                              fontFamily: '"Fira Code", "Courier New", monospace',
                              textShadow: '0 0 2px rgba(0, 255, 255, 0.3)'
                            }}
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}
              </Paper>
            </ListItem>
          ))}
          {processing && (
            <ListItem sx={{ display: 'flex', alignItems: 'center' }}>
              <BotIcon color="secondary" sx={{ mr: 1 }} />
              <CircularProgress size={20} />
              <Typography variant="body2" sx={{ ml: 1 }} color="text.secondary">
                Claude is thinking...
              </Typography>
            </ListItem>
          )}
        </List>
        <div ref={messagesEndRef} />
      </Box>
      
      <Box sx={{ p: 2, borderTop: '1px solid rgba(0,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        {selectedFiles.length > 0 && (
          <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selectedFiles.map(file => (
              <Chip
                key={file}
                label={`@${file.split('/').pop()}`}
                size="small"
                onDelete={() => {
                  // const newFiles = selectedFiles.filter(f => f !== file);
                  onClearFiles?.();
                  // Need to pass newFiles back to parent
                }}
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={6}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            disabled={disabled || processing || isRecording || isTranscribing}
            variant="outlined"
            size="small"
            error={!!voiceError}
            helperText={voiceError || (isTranscribing ? 'Transcribing...' : '')}
            sx={{
              '& .MuiInputBase-input': {
                minHeight: '40px',
              }
            }}
          />
          {voiceEnabled && (
            <Tooltip title={
              isRecording ? 'Stop recording' : 
              isTranscribing ? 'Transcribing...' : 
              'Start voice input'
            }>
              <IconButton
                color={isRecording ? 'error' : 'primary'}
                onClick={toggleRecording}
                disabled={disabled || processing || isTranscribing}
                sx={{
                  animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                    '100%': { opacity: 1 }
                  }
                }}
              >
                {isTranscribing ? (
                  <CircularProgress size={24} />
                ) : isRecording ? (
                  <StopIcon />
                ) : (
                  <MicIcon />
                )}
              </IconButton>
            </Tooltip>
          )}
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={disabled || processing || !input.trim()}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatInterface;