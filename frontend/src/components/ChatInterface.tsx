import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
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
  ListItem,
  Button
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
  Stop as StopIcon,
  StopCircle as StopCircleIcon,
  CompressOutlined as CompactIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { cyberpunkCodeTheme } from '../theme/cyberpunkCodeTheme';
import { useClaudeStore } from '../store/claudeStore';
import { useVoiceInput } from '../hooks/useVoiceInput';
import ToolResultBlock from './ToolResultBlock';
import { MarkdownFileSelector } from './MarkdownFileSelector';

interface ChatInterfaceProps {
  onSendMessage: (message: string, markdownFiles?: string[]) => void;
  onStopProcess?: () => void;
  onCompactConversation?: () => void;
  disabled?: boolean;
  selectedFiles?: string[];
  onClearFiles?: () => void;
  workingDirectory?: string | null;
}

// Memoized message component
const ChatMessage = memo(({ message, getMessageIcon, getMessageColor, getMessageBorder, onCompactConversation }: any) => {
  // Check if this is a "Prompt is too long" error message
  const isPromptTooLong = message.type === 'assistant' && message.content === 'Prompt is too long';
  
  return (
    <ListItem
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        mb: 2,
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
          maxWidth: message.type === 'user' ? '70%' : '95%',
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
        {isPromptTooLong ? (
          <Box>
            <Typography variant="body2" color="error" sx={{ mb: 2 }}>
              The conversation has exceeded the context limit.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<CompactIcon />}
              onClick={onCompactConversation}
              sx={{
                backgroundColor: 'rgba(0, 255, 255, 0.1)',
                color: '#00ffff',
                '&:hover': {
                  backgroundColor: 'rgba(0, 255, 255, 0.2)',
                }
              }}
            >
              Compact & Edit into new session
            </Button>
          </Box>
        ) : message.type === 'tool_result' ? (
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
  );
});

ChatMessage.displayName = 'ChatMessage';

// Memoized messages list
const MessagesList = memo(({ messages, processing, getMessageIcon, getMessageColor, getMessageBorder, onCompactConversation }: any) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <>
      <List>
        {messages.map((message: any) => (
          <ChatMessage
            key={message.id}
            message={message}
            getMessageIcon={getMessageIcon}
            getMessageColor={getMessageColor}
            getMessageBorder={getMessageBorder}
            onCompactConversation={onCompactConversation}
          />
        ))}
        {processing && (
          <ListItem sx={{ display: 'flex', alignItems: 'center' }}>
            <BotIcon color="secondary" sx={{ mr: 1 }} />
            <CircularProgress size={20} />
            <Typography sx={{ ml: 2 }} color="text.secondary">
              Claude is thinking...
            </Typography>
          </ListItem>
        )}
      </List>
      <div ref={messagesEndRef} />
    </>
  );
});

MessagesList.displayName = 'MessagesList';

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onSendMessage, onStopProcess, onCompactConversation, disabled, selectedFiles = [], onClearFiles, workingDirectory }) => {
  const [input, setInput] = useState('');
  const [messageFilters, setMessageFilters] = useState<string[]>(['user', 'assistant']);
  const [voiceError, setVoiceError] = useState<string>('');
  const [selectedMarkdownFiles, setSelectedMarkdownFiles] = useState<string[]>([]);
  const { messages, processing, clearMessages, totalTokens, model, pendingInput, setPendingInput } = useClaudeStore();
  
  const { isRecording, isTranscribing, voiceEnabled, toggleRecording } = useVoiceInput({
    onTranscription: (text) => {
      setInput(prev => prev ? `${prev} ${text}` : text);
      setVoiceError('');
    },
    onError: (error) => {
      setVoiceError(error);
      setTimeout(() => setVoiceError(''), 10000);
    }
  });

  const filteredMessages = useMemo(() => 
    messages
      .filter(msg => messageFilters.includes(msg.type))
      .sort((a, b) => a.timestamp - b.timestamp),
    [messages, messageFilters]
  );

  const isSendingRef = useRef(false);

  // ESC key handler to stop process
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && processing && onStopProcess) {
        console.log('ESC key pressed - stopping process');
        onStopProcess();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [processing, onStopProcess]);
  
  // Populate input from pendingInput when it changes
  useEffect(() => {
    if (pendingInput) {
      setInput(pendingInput);
      setPendingInput(null); // Clear it after using
    }
  }, [pendingInput, setPendingInput]);
  
  const handleSend = useCallback(() => {
    if (input.trim() && !disabled && !processing) {
      // Prevent double-sending
      if (isSendingRef.current) {
        console.warn('Already sending message, ignoring duplicate send');
        return;
      }
      
      isSendingRef.current = true;
      
      let messageWithFiles = input;
      if (selectedFiles.length > 0) {
        const fileRefs = selectedFiles.map(f => `@${f}`).join(' ');
        messageWithFiles = `${fileRefs} ${input}`;
      }
      console.log('ChatInterface handleSend:', messageWithFiles);
      console.log('With markdown files:', selectedMarkdownFiles);
      
      // Pass the selected markdown files to the parent
      onSendMessage(messageWithFiles, selectedMarkdownFiles.length > 0 ? selectedMarkdownFiles : undefined);
      setInput('');
      onClearFiles?.();
      
      // Clear markdown files after sending
      setSelectedMarkdownFiles([]);
      
      // Reset the flag after a short delay
      setTimeout(() => {
        isSendingRef.current = false;
      }, 500);
    }
  }, [input, disabled, processing, selectedFiles, selectedMarkdownFiles, onSendMessage, onClearFiles]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleFilterChange = useCallback((_event: React.MouseEvent<HTMLElement>, newFilters: string[]) => {
    if (newFilters.length > 0) {
      setMessageFilters(newFilters);
    }
  }, []);

  const getMessageIcon = useCallback((type: string) => {
    switch(type) {
      case 'user': return <PersonIcon color="primary" />;
      case 'assistant': return <BotIcon color="secondary" />;
      case 'thinking': return <PsychologyIcon sx={{ color: '#ffaa00' }} />;
      case 'tool_use': return <BuildIcon sx={{ color: '#00ff88' }} />;
      case 'tool_result': return <CodeIcon sx={{ color: '#00aaff' }} />;
      default: return <BotIcon color="secondary" />;
    }
  }, []);

  const getMessageColor = useCallback((type: string) => {
    switch(type) {
      case 'user': return 'rgba(0, 255, 255, 0.05)';
      case 'assistant': return 'rgba(255, 0, 255, 0.03)';
      case 'thinking': return 'rgba(255, 170, 0, 0.03)';
      case 'tool_use': return 'rgba(0, 255, 136, 0.03)';
      case 'tool_result': return 'rgba(0, 170, 255, 0.03)';
      default: return 'rgba(255, 0, 255, 0.03)';
    }
  }, []);

  const getMessageBorder = useCallback((type: string) => {
    switch(type) {
      case 'user': return '1px solid rgba(0, 255, 255, 0.2)';
      case 'assistant': return '1px solid rgba(255, 0, 255, 0.15)';
      case 'thinking': return '1px solid rgba(255, 170, 0, 0.15)';
      case 'tool_use': return '1px solid rgba(0, 255, 136, 0.15)';
      case 'tool_result': return '1px solid rgba(0, 170, 255, 0.15)';
      default: return '1px solid rgba(255, 0, 255, 0.15)';
    }
  }, []);

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
      
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <MessagesList
          messages={filteredMessages}
          processing={processing}
          getMessageIcon={getMessageIcon}
          getMessageColor={getMessageColor}
          getMessageBorder={getMessageBorder}
          onCompactConversation={onCompactConversation}
        />
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
                  onClearFiles?.();
                }}
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <MarkdownFileSelector
            workingDirectory={workingDirectory}
            selectedFiles={selectedMarkdownFiles}
            onSelectionChange={setSelectedMarkdownFiles}
          />
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
              },
              '& .MuiInputBase-root': {
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                },
                '&.Mui-focused': {
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                }
              }
            }}
          />
          <Tooltip title={
            !voiceEnabled ? "Voice input not available (requires HTTPS)" :
            isRecording ? "Stop recording" :
            isTranscribing ? "Transcribing..." :
            "Start recording"
          }>
            <span>
              <IconButton
                onClick={toggleRecording}
                disabled={!voiceEnabled || disabled || processing || isTranscribing}
                color={isRecording ? "error" : "default"}
                sx={{
                  backgroundColor: isRecording ? 'rgba(255, 0, 0, 0.1)' : 'transparent',
                  '&:hover': {
                    backgroundColor: isRecording ? 'rgba(255, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                {isRecording ? <StopIcon /> : isTranscribing ? <CircularProgress size={20} /> : voiceEnabled ? <MicIcon /> : <MicOffIcon />}
              </IconButton>
            </span>
          </Tooltip>
          {processing ? (
            <Tooltip title="Stop Claude (ESC)">
              <IconButton 
                onClick={onStopProcess} 
                color="error"
                sx={{
                  backgroundColor: 'rgba(255, 0, 0, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 0, 0, 0.2)',
                  },
                }}
              >
                <StopCircleIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <IconButton onClick={handleSend} disabled={disabled || !input.trim()}>
              <SendIcon />
            </IconButton>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ChatInterface;