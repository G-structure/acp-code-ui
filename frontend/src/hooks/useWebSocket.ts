import { useEffect, useState, useRef, useCallback } from 'react';
import { useClaudeStore } from '../store/claudeStore';

interface WebSocketMessage {
  type: string;
  data?: any;
  error?: string;
  event?: any;
  message?: any;
}

export function useWebSocket(onReady?: () => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const pingInterval = useRef<NodeJS.Timeout>();
  const isConnecting = useRef(false);
  const { addOutput, addHookEvent, addJsonDebug, setSessionId, setProcessing, setSystemInfo, updateTokenCount } = useClaudeStore();

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN || isConnecting.current) {
      return;
    }
    
    isConnecting.current = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsPort = import.meta.env.VITE_WS_PORT || '3002'; // Use separate WebSocket port
    // Use 127.0.0.1 instead of localhost to avoid potential DNS/proxy issues
    const wsUrl = `${protocol}//127.0.0.1:${wsPort}`;
    
    console.log('Connecting to WebSocket at:', wsUrl);
    
    try {
      ws.current = new WebSocket(wsUrl);
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      isConnecting.current = false;
      setTimeout(() => connect(), 3000);
      return;
    }

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      isConnecting.current = false;
      setIsConnected(true);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      
      // Set up client-side ping interval
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
      }
      pingInterval.current = setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000); // Ping every 25 seconds (slightly less than server's 30s timeout)
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setMessages((prev) => [...prev, message]);
        
        switch (message.type) {
          case 'pong':
            // Server responded to our ping
            break;
            
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
            // Call the onReady callback if provided (with a small delay to ensure file is written)
            if (onReady) {
              setTimeout(onReady, 500);
            }
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
            
          case 'session-id-changed':
            // Handle Claude providing its actual session ID
            if (message.data?.newId) {
              console.log(`Session ID updated from ${message.data.oldId} to ${message.data.newId}`);
              setSessionId(message.data.newId);
              // Don't switch sessions here - just update the session ID
              // The UI should continue to use the original session ID for tabs
            }
            break;
            
          case 'process-stopped':
            console.log('Claude process stopped');
            setProcessing(false);
            // Add a system message that the process was stopped
            const { addMessage: addStopMessage } = useClaudeStore.getState();
            addStopMessage({
              id: `system-${Date.now()}`,
              type: 'system',
              content: '⚠️ Process interrupted by user',
              timestamp: Date.now()
            });
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
      isConnecting.current = false;
      setIsConnected(false);
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket disconnected:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        timestamp: new Date().toISOString()
      });
      
      // Code 1006 means abnormal closure (like process killed)
      if (event.code === 1006) {
        console.warn('WebSocket abnormally closed - likely killed by external process');
      }
      
      isConnecting.current = false;
      setIsConnected(false);
      ws.current = null;
      
      // Clear ping interval
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
      }
      
      // Don't reset app state - just reconnect
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      reconnectTimeout.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 1000); // Faster reconnect for abnormal closures
    };
  }, [addOutput, addHookEvent, addJsonDebug, setSessionId, setProcessing, setSystemInfo, updateTokenCount]);

  useEffect(() => {
    // Only connect once on mount
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []); // Empty dependency array - only run once on mount

  const lastSendTime = useRef<number>(0);
  
  const sendMessage = useCallback((message: any) => {
    // Add debouncing for send-prompt messages
    if (message.type === 'send-prompt') {
      const now = Date.now();
      if (now - lastSendTime.current < 500) {
        console.warn('Ignoring rapid send-prompt, last send was', now - lastSendTime.current, 'ms ago');
        return;
      }
      lastSendTime.current = now;
    }
    
    const attemptSend = () => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        console.log('Sending WebSocket message:', message.type, message.prompt?.substring(0, 50));
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
  
  const stopProcess = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      console.log('Sending stop-process command');
      ws.current.send(JSON.stringify({ type: 'stop-process' }));
    } else {
      console.warn('WebSocket not connected, cannot stop process');
    }
  }, []);

  return {
    isConnected,
    messages,
    sendMessage,
    disconnect,
    stopProcess
  };
}