import { useEffect, useState, useRef, useCallback } from 'react';
import { useClaudeStore } from '../store/claudeStore';

interface WebSocketMessage {
  type: string;
  data?: any;
  error?: string;
  event?: any;
  message?: any;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const { addOutput, addHookEvent, addJsonDebug, setSessionId, setProcessing, setSystemInfo, updateTokenCount } = useClaudeStore();

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//localhost:3001`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setMessages((prev) => [...prev, message]);
        
        switch (message.type) {
          case 'system-info':
            console.log('System info:', message.data);
            setSystemInfo(message.data);
            break;
            
          case 'chat-message':
            // Handle chat messages from JSON mode
            const { addMessage } = useClaudeStore.getState();
            if (message.message) {
              // Calculate tokens from usage data
              let tokens = undefined;
              if (message.message.usage) {
                // Get the output tokens from the usage object
                tokens = message.message.usage.output_tokens || undefined;
              }
              const newMessage = {
                ...message.message,
                tokens
              };
              
              // Add to current view - the store will handle session updates
              addMessage(newMessage);
            }
            break;
            
          case 'chat-message-update':
            // Handle streaming updates
            const { updateMessage } = useClaudeStore.getState();
            if (message.data?.id && message.data?.content) {
              let tokens = undefined;
              if (message.data.usage) {
                tokens = message.data.usage.output_tokens || undefined;
              }
              updateMessage(message.data.id, message.data.content, {
                model: message.data.model,
                tokens
              });
            }
            break;
            
          case 'chat-message-finalize':
            // Handle end of streaming
            const { finalizeMessage } = useClaudeStore.getState();
            if (message.data?.id) {
              finalizeMessage(message.data.id);
            }
            break;
            
          case 'json-debug':
            // Handle JSON debug data
            addJsonDebug(message.data);
            break;
            
          case 'hook-event':
            addHookEvent(message.event);
            break;
            
          case 'session-started':
            if (message.data?.sessionId) {
              setSessionId(message.data.sessionId);
            }
            break;
            
          case 'ready':
            setProcessing(false);
            console.log('Claude is ready for input');
            break;
            
          case 'tool-use':
            // Log tool usage for debugging
            console.log('Tool use:', message.data);
            // Could add this to a tool usage log in the store if needed
            break;
            
          case 'tool-result':
            // Log tool results for debugging
            console.log('Tool result:', message.data);
            break;
            
          case 'token-usage':
            // Handle token usage updates
            console.log('Token usage:', message.data);
            if (message.data) {
              const totalTokens = (message.data.input_tokens || 0) + 
                                  (message.data.output_tokens || 0) +
                                  (message.data.cache_creation_input_tokens || 0) +
                                  (message.data.cache_read_input_tokens || 0);
              // Set the total, don't add to it
              useClaudeStore.setState({ totalTokens });
            }
            break;
            
          case 'todo-update':
            // Handle todo updates from TodoWrite tool
            const { updateTodos } = useClaudeStore.getState();
            if (message.data?.todos) {
              console.log('Todo update:', message.data.todos);
              updateTodos(message.data.todos);
            }
            break;
            
          case 'session-info':
            // Update session info
            if (message.data?.sessionId) {
              setSessionId(message.data.sessionId);
            }
            break;
            
          case 'error':
            console.error('WebSocket error:', message.error);
            alert(`Error: ${message.error}`);
            setProcessing(false);
            break;
            
          default:
            console.log('Unknown message type:', message.type)
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      ws.current = null;
      
      reconnectTimeout.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 3000);
    };
  }, [addOutput, addHookEvent, addJsonDebug, setSessionId, setProcessing, setSystemInfo, updateTokenCount]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: any) => {
    const attemptSend = () => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(message));
        return true;
      }
      return false;
    };

    if (!attemptSend()) {
      // Try to connect first
      connect();
      // Wait a bit and try again
      setTimeout(() => {
        if (!attemptSend()) {
          console.error('WebSocket is not connected after retry');
        }
      }, 500);
    }
  }, [connect]);

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  return {
    isConnected,
    messages,
    sendMessage,
    disconnect
  };
}