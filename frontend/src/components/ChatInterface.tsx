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
  Button,
  Select,
  MenuItem,
  FormControl
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
  CompressOutlined as CompactIcon,
  AutoAwesome as AutoIcon
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
  
  // Parse thinking mode from user messages
  let displayContent = message.content;
  let thinkingMode = null;
  
  if (message.type === 'user') {
    const thinkingMatch = displayContent.match(/^Please use thinking mode: ([\w-]+)\.\n/);
    if (thinkingMatch) {
      // Extract thinking mode and remove it from display
      const mode = thinkingMatch[1];
      thinkingMode = mode.replace('-think', '');
      displayContent = displayContent.replace(thinkingMatch[0], '');
    }
  }
  
  // Parse thinking tags from assistant messages
  const parseThinkingTags = (content: string) => {
    const tagRegex = /<([\w_]*thinking[\w_]*)>([\s\S]*?)<\/\1>/gi;
    const parts: any[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
      // Add text before the tag
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
      }
      // Add the thinking content
      parts.push({ type: 'thinking', content: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.slice(lastIndex) });
    }
    
    return parts.length > 0 ? parts : [{ type: 'text', content }];
  };
  
  const contentParts = message.type === 'assistant' ? parseThinkingTags(displayContent) : null;
  
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
          {thinkingMode && (
            <Tooltip title={`${thinkingMode} thinking mode`}>
              <Chip
                icon={<PsychologyIcon />}
                label={thinkingMode}
                size="small"
                sx={{
                  backgroundColor: thinkingMode === 'ultra' ? 'rgba(255, 0, 102, 0.15)' :
                                   thinkingMode === 'deep' ? 'rgba(255, 170, 0, 0.15)' :
                                   'rgba(0, 255, 255, 0.1)',
                  color: thinkingMode === 'ultra' ? '#ff0066' :
                         thinkingMode === 'deep' ? '#ffaa00' :
                         '#00ffff',
                  '& .MuiChip-icon': {
                    color: 'inherit'
                  }
                }}
              />
            </Tooltip>
          )}
          <Typography variant="caption" color="text.secondary">
            {new Date(message.timestamp).toLocaleTimeString()}
          </Typography>
          {message.tokens && (
            <Typography variant="caption" color="text.secondary">
              • {message.tokens} tokens
            </Typography>
          )}
        </Box>
        {message.type === 'tool_use' && message.tool_input ? (
          <Box>
            <Typography variant="subtitle2" sx={{ color: '#00ff88', mb: 1 }}>
              {message.tool_name}
            </Typography>
            {(() => {
              // Format tool input based on tool type
              const input = message.tool_input;
              if (typeof input === 'object' && input !== null) {
                // Common tool patterns
                if (input.command) {
                  // Bash command
                  return (
                    <Box sx={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.5)', 
                      p: 1.5, 
                      borderRadius: 1,
                      border: '1px solid rgba(0, 255, 255, 0.2)',
                      fontFamily: '"SF Mono", monospace',
                      fontSize: '0.9em'
                    }}>
                      <Typography sx={{ color: '#00ffff', fontFamily: 'inherit' }}>
                        $ {input.command}
                      </Typography>
                      {input.description && (
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block', mt: 0.5 }}>
                          {input.description}
                        </Typography>
                      )}
                    </Box>
                  );
                } else if (input.file_path || input.path) {
                  // File operations
                  const filePath = input.file_path || input.path;
                  return (
                    <Box>
                      <Typography sx={{ color: '#00aaff', fontFamily: '"SF Mono", monospace', fontSize: '0.9em' }}>
                        📄 {filePath}
                      </Typography>
                      {(input.old_string || input.content || input.pattern) && (
                        <Box sx={{ 
                          mt: 1, 
                          p: 1, 
                          backgroundColor: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: 1,
                          fontSize: '0.85em'
                        }}>
                          {input.old_string && (
                            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', whiteSpace: 'pre-wrap' }}>
                              Replacing: {input.old_string}
                            </Typography>
                          )}
                          {input.pattern && (
                            <Typography sx={{ color: '#ffaa00', fontFamily: '"SF Mono", monospace' }}>
                              Pattern: {input.pattern}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  );
                } else if (input.prompt) {
                  // Task or prompt-based tools
                  return (
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', whiteSpace: 'pre-wrap' }}>
                      {input.prompt}
                    </Typography>
                  );
                } else if (input.todos) {
                  // TodoWrite
                  return (
                    <Box>
                      {input.todos.map((todo: any, i: number) => (
                        <Typography key={i} sx={{ 
                          color: todo.status === 'completed' ? '#00ff88' : 
                                 todo.status === 'in_progress' ? '#ffaa00' : 
                                 'rgba(255, 255, 255, 0.6)',
                          fontSize: '0.9em'
                        }}>
                          {todo.status === 'completed' ? '✓' : 
                           todo.status === 'in_progress' ? '▶' : '○'} {todo.content}
                        </Typography>
                      ))}
                    </Box>
                  );
                } else {
                  // Generic object display
                  const displayKeys = Object.keys(input).slice(0, 3);
                  return (
                    <Box sx={{ fontSize: '0.9em' }}>
                      {Object.keys(input).map(key => (
                        <Typography key={key} sx={{ color: 'rgba(255, 255, 255, 0.7)', whiteSpace: 'pre-wrap' }}>
                          {key}: {JSON.stringify(input[key], null, 2)}
                        </Typography>
                      ))}
                    </Box>
                  );
                }
              } else {
                // Simple string/number input
                return (
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    {String(input)}
                  </Typography>
                );
              }
            })()}
          </Box>
        ) : isPromptTooLong ? (
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
        ) : message.type === 'assistant' && contentParts && contentParts.some((p: any) => p.type === 'thinking') ? (
          <Box>
            {contentParts.map((part: any, index: number) => (
              part.type === 'thinking' ? (
                <Box key={index} sx={{ 
                  mt: index > 0 ? 1 : 0,
                  mb: 1,
                  p: 2,
                  backgroundColor: 'rgba(128, 128, 128, 0.1)',
                  borderLeft: '3px solid rgba(128, 128, 128, 0.3)',
                  borderRadius: 1
                }}>
                  <Typography variant="caption" sx={{ color: 'rgba(128, 128, 128, 0.8)', display: 'block', mb: 0.5 }}>
                    💭 Thinking
                  </Typography>
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
                              border: '1px solid rgba(128, 128, 128, 0.2)',
                              borderRadius: '4px',
                              padding: '12px',
                            }}
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} style={{
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            color: 'rgba(160, 160, 160, 0.9)',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            border: '1px solid rgba(128, 128, 128, 0.2)',
                            fontSize: '0.9em',
                            fontFamily: '"SF Mono", "Fira Code", "Courier New", monospace',
                          }} {...props}>
                            {children}
                          </code>
                        );
                      },
                      p: ({ children }: any) => (
                        <Typography sx={{ color: 'rgba(160, 160, 160, 0.9)', mb: 1 }}>
                          {children}
                        </Typography>
                      ),
                      li: ({ children }: any) => (
                        <li style={{ color: 'rgba(160, 160, 160, 0.9)' }}>
                          {children}
                        </li>
                      )
                    }}
                  >
                    {part.content}
                  </ReactMarkdown>
                </Box>
              ) : part.content.trim() ? (
                <ReactMarkdown
                  key={index}
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
                            fontFamily: '"SF Mono", "Fira Code", "Courier New", monospace',
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
                  {part.content}
                </ReactMarkdown>
              ) : null
            ))}
          </Box>
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
                      fontFamily: '"SF Mono", "Fira Code", "Courier New", monospace',
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
            {displayContent}
          </ReactMarkdown>
        )}
      </Paper>
    </ListItem>
  );
});

ChatMessage.displayName = 'ChatMessage';

// Memoized messages list
const MessagesList = memo(({ messages, processing, processingStatus, getMessageIcon, getMessageColor, getMessageBorder, onCompactConversation }: any) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Use a small timeout to ensure DOM has updated with new content
    const scrollTimer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(scrollTimer);
  }, [messages.length, messages]);

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
            <Box sx={{ ml: 2 }}>
              <Typography color="text.secondary">
                Claude is thinking...
              </Typography>
              {processingStatus && (
                <Typography variant="caption" color="text.secondary" sx={{ 
                  display: 'block',
                  mt: 0.5,
                  fontStyle: 'italic',
                  opacity: 0.8,
                  maxWidth: '90%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {processingStatus}
                </Typography>
              )}
            </Box>
          </ListItem>
        )}
      </List>
      <div ref={messagesEndRef} style={{ height: 1, marginBottom: 20 }} />
    </>
  );
});

MessagesList.displayName = 'MessagesList';

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onSendMessage, onStopProcess, onCompactConversation, disabled, selectedFiles = [], onClearFiles, workingDirectory }) => {
  const [input, setInput] = useState('');
  const [messageFilters, setMessageFilters] = useState<string[]>(['user', 'assistant']);
  const [voiceError, setVoiceError] = useState<string>('');
  const [selectedMarkdownFiles, setSelectedMarkdownFiles] = useState<string[]>([]);
  const [thinkingMode, setThinkingMode] = useState<string>('auto');
  const { messages, processing, processingStatus, clearMessages, totalTokens, model, pendingInput, setPendingInput } = useClaudeStore();
  
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
      
      // Add thinking mode prefix if not auto
      if (thinkingMode !== 'auto') {
        const thinkingModeText = thinkingMode === 'ultra' ? 'ultra-think' : 
                                 thinkingMode === 'deep' ? 'deep-think' :
                                 thinkingMode === 'normal' ? 'normal-think' : thinkingMode;
        messageWithFiles = `Please use thinking mode: ${thinkingModeText}.\n${messageWithFiles}`;
        
        // Add a visual indicator in the UI
        const thinkingNote = {
          id: `thinking-mode-${Date.now()}`,
          type: 'system',
          content: `🧠 Using ${thinkingMode} thinking mode`,
          timestamp: Date.now()
        };
        const { addMessage } = useClaudeStore.getState();
        addMessage(thinkingNote);
      }
      
      if (selectedFiles.length > 0) {
        const fileRefs = selectedFiles.map(f => `@${f}`).join(' ');
        messageWithFiles = `${fileRefs} ${messageWithFiles}`;
      }
      console.log('ChatInterface handleSend:', messageWithFiles);
      console.log('With markdown files:', selectedMarkdownFiles);
      console.log('Thinking mode:', thinkingMode);
      
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
  }, [input, disabled, processing, selectedFiles, selectedMarkdownFiles, thinkingMode, onSendMessage, onClearFiles]);

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
          processingStatus={processingStatus}
          getMessageIcon={getMessageIcon}
          getMessageColor={getMessageColor}
          getMessageBorder={getMessageBorder}
          onCompactConversation={onCompactConversation}
        />
      </Box>
      
      <Box sx={{ p: 2, borderTop: '1px solid rgba(0,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        {(selectedFiles.length > 0 || selectedMarkdownFiles.length > 0) && (
          <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 1 }}>
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
            {selectedMarkdownFiles.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selectedMarkdownFiles.map(file => (
                  <Chip
                    key={file}
                    label={file.split('/').pop()}
                    size="small"
                    onDelete={() => setSelectedMarkdownFiles(selectedMarkdownFiles.filter(f => f !== file))}
                    sx={{
                      backgroundColor: 'rgba(0, 255, 255, 0.1)',
                      color: '#00ffff',
                      '& .MuiChip-deleteIcon': {
                        color: 'rgba(0, 255, 255, 0.6)',
                        '&:hover': {
                          color: '#00ffff',
                        }
                      }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <MarkdownFileSelector
            workingDirectory={workingDirectory}
            selectedFiles={selectedMarkdownFiles}
            onSelectionChange={setSelectedMarkdownFiles}
          />
          <Tooltip title={
            thinkingMode === 'auto' ? "Claude chooses thinking depth automatically" :
            thinkingMode === 'normal' ? "Normal thinking mode" :
            thinkingMode === 'deep' ? "Deep thinking for complex problems" :
            "Ultra thinking for the most complex challenges"
          }>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={thinkingMode}
              onChange={(e) => setThinkingMode(e.target.value)}
              displayEmpty
              startAdornment={
                thinkingMode === 'auto' ? (
                  <AutoIcon sx={{ fontSize: 18, mr: 0.5, color: 'rgba(0, 255, 255, 0.6)' }} />
                ) : (
                  <PsychologyIcon sx={{ fontSize: 18, mr: 0.5, color: 'rgba(255, 170, 0, 0.6)' }} />
                )
              }
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                '& .MuiSelect-select': {
                  py: 0.75,
                  display: 'flex',
                  alignItems: 'center',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: thinkingMode !== 'auto' ? 'rgba(255, 170, 0, 0.3)' : 'rgba(0, 255, 255, 0.2)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: thinkingMode !== 'auto' ? 'rgba(255, 170, 0, 0.5)' : 'rgba(0, 255, 255, 0.4)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: thinkingMode !== 'auto' ? '#ffaa00' : '#00ffff',
                },
              }}
            >
              <MenuItem value="auto" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoIcon sx={{ fontSize: 18 }} />
                Auto
              </MenuItem>
              <MenuItem value="normal" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PsychologyIcon sx={{ fontSize: 18 }} />
                Normal
              </MenuItem>
              <MenuItem value="deep" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PsychologyIcon sx={{ fontSize: 18, color: '#ffaa00' }} />
                Deep
              </MenuItem>
              <MenuItem value="ultra" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PsychologyIcon sx={{ fontSize: 18, color: '#ff0066' }} />
                Ultra
              </MenuItem>
            </Select>
          </FormControl>
          </Tooltip>
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