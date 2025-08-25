import { create } from 'zustand';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'thinking' | 'tool_use' | 'tool_result';
  content: string;
  timestamp: number;
  streaming?: boolean;
  tokens?: number;
  model?: string;
  tool_name?: string;
  tool_input?: any;
  tool_result?: any;
}

interface HookEvent {
  type: string;
  timestamp: number;
  sessionId?: string;
  data: any;
}

interface TodoItem {
  content: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface SessionData {
  id: string;
  messages: Message[];
  totalTokens: number;
  model: string | null;
  active: boolean;
  processing: boolean;
  jsonDebugLog: any[];
  todos: TodoItem[];
}

interface ClaudeStore {
  sessionActive: boolean;
  sessionId: string | null;
  processing: boolean;
  messages: Message[];
  output: string[];
  hookEvents: HookEvent[];
  jsonDebugLog: any[];
  totalTokens: number;
  model: string | null;
  sessions: Record<string, SessionData>;
  activeSessionId: string | null;
  todos: TodoItem[];
  
  startSession: (workingDirectory: string) => Promise<void>;
  stopSession: () => Promise<void>;
  sendPrompt: (prompt: string) => void;
  addMessage: (message: Partial<Message> & Pick<Message, 'type' | 'content'>) => void;
  updateMessage: (id: string, content: string, metadata?: { tokens?: number; model?: string }) => void;
  finalizeMessage: (id: string) => void;
  addOutput: (output: string) => void;
  addHookEvent: (event: HookEvent) => void;
  addJsonDebug: (data: any) => void;
  clearOutput: () => void;
  clearMessages: () => void;
  clearHookEvents: () => void;
  clearJsonDebug: () => void;
  setSessionId: (id: string | null) => void;
  setProcessing: (processing: boolean) => void;
  setSystemInfo: (info: { model?: string; tools?: string[]; cwd?: string }) => void;
  updateTokenCount: (tokens: number) => void;
  switchSession: (sessionId: string) => void;
  createSession: (sessionId: string) => void;
  updateSessionMessages: (sessionId: string, messages: Message[]) => void;
  updateTodos: (todos: TodoItem[]) => void;
}

export const useClaudeStore = create<ClaudeStore>((set) => ({
    sessionActive: false,
    sessionId: null,
    processing: false,
    messages: [],
    output: [],
    hookEvents: [],
    jsonDebugLog: [],
    totalTokens: 0,
    model: null,
    sessions: {},
    activeSessionId: null,
    todos: [],
    
    startSession: async (_workingDirectory: string) => {
      set({
        sessionActive: true,
        processing: false,  // Start with false, will be set to true when sending messages
        messages: [],
        output: [],
        hookEvents: [],
        totalTokens: 0,
        model: null
      });
    },
    
    stopSession: async () => {
      set({
        sessionActive: false,
        sessionId: null,
        processing: false
      });
    },
    
    sendPrompt: (prompt: string) => {
      // Add user message to chat
      const newMessage: Message = {
        id: `msg-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        type: 'user',
        content: prompt
      };
      set((state) => {
        const updatedMessages = [...state.messages, newMessage];
        
        // Also update the session's stored messages if we have an active session
        if (state.activeSessionId && state.sessions[state.activeSessionId]) {
          const updatedSessions = { ...state.sessions };
          updatedSessions[state.activeSessionId] = {
            ...updatedSessions[state.activeSessionId],
            messages: updatedMessages
          };
          
          return {
            messages: updatedMessages,
            processing: true,
            sessions: updatedSessions
          };
        }
        
        return {
          messages: updatedMessages,
          processing: true
        };
      });
    },
    
    addMessage: (message) => {
      const messageId = message.id || `msg-${Date.now()}-${Math.random()}`;
      
      set((state) => {
        // Check if message with this ID already exists
        const existingIndex = state.messages.findIndex(m => m.id === messageId);
        if (existingIndex !== -1) {
          // Update existing message instead of adding duplicate
          const updatedMessages = [...state.messages];
          updatedMessages[existingIndex] = {
            ...updatedMessages[existingIndex],
            ...message,
            id: messageId,
            timestamp: message.timestamp || updatedMessages[existingIndex].timestamp
          };
          
          // Also update the session's stored messages if we have an active session
          if (state.activeSessionId && state.sessions[state.activeSessionId]) {
            const updatedSessions = { ...state.sessions };
            updatedSessions[state.activeSessionId] = {
              ...updatedSessions[state.activeSessionId],
              messages: updatedMessages
            };
            return { messages: updatedMessages, sessions: updatedSessions };
          }
          
          return { messages: updatedMessages };
        }
        
        // Add new message
        const newMessage: Message = {
          ...message,
          id: messageId,
          timestamp: Date.now()
        };
        const updatedMessages = [...state.messages, newMessage];
        
        // Also update the session's stored messages if we have an active session
        if (state.activeSessionId && state.sessions[state.activeSessionId]) {
          const updatedSessions = { ...state.sessions };
          updatedSessions[state.activeSessionId] = {
            ...updatedSessions[state.activeSessionId],
            messages: updatedMessages
          };
          return { messages: updatedMessages, sessions: updatedSessions };
        }
        
        return { messages: updatedMessages };
      });
    },
    
    updateMessage: (id: string, content: string, metadata?: { tokens?: number; model?: string }) => {
      set((state) => {
        const updatedMessages = state.messages.map(msg => 
          msg.id === id ? { ...msg, content, ...metadata } : msg
        );
        
        // Also update the session's stored messages if we have an active session
        if (state.activeSessionId && state.sessions[state.activeSessionId]) {
          const updatedSessions = { ...state.sessions };
          updatedSessions[state.activeSessionId] = {
            ...updatedSessions[state.activeSessionId],
            messages: updatedMessages
          };
          return { messages: updatedMessages, sessions: updatedSessions };
        }
        
        return {
          messages: updatedMessages
        };
      });
    },
    
    finalizeMessage: (id: string) => {
      set((state) => ({
        messages: state.messages.map(msg => 
          msg.id === id ? { ...msg, streaming: false, timestamp: Date.now() } : msg
        )
      }));
    },
    
    addOutput: (output: string) => {
      set((state) => ({
        output: [...state.output, output]
      }));
      
      // Don't add terminal output to chat messages
      // The chat should only show user prompts and Claude's actual responses
    },
    
    addHookEvent: (event: HookEvent) => {
      set((state) => ({
        hookEvents: [...state.hookEvents, event].slice(-100)
      }));
    },
    
    addJsonDebug: (data: any) => {
      set((state) => {
        const newEntry = {
          timestamp: Date.now(),
          ...data
        };
        
        const updatedLog = [...state.jsonDebugLog, newEntry].slice(-500); // Keep last 500 entries
        
        // Also update the session's JSON debug log if we have an active session
        if (state.activeSessionId && state.sessions[state.activeSessionId]) {
          const updatedSessions = { ...state.sessions };
          updatedSessions[state.activeSessionId] = {
            ...updatedSessions[state.activeSessionId],
            jsonDebugLog: [...(updatedSessions[state.activeSessionId].jsonDebugLog || []), newEntry].slice(-500)
          };
          
          return {
            jsonDebugLog: updatedLog,
            sessions: updatedSessions
          };
        }
        
        return {
          jsonDebugLog: updatedLog
        };
      });
    },
    
    clearOutput: () => {
      set({ output: [] });
    },
    
    clearMessages: () => {
      set((state) => {
        // Clear messages for current session only
        if (state.activeSessionId && state.sessions[state.activeSessionId]) {
          const updatedSessions = { ...state.sessions };
          updatedSessions[state.activeSessionId] = {
            ...updatedSessions[state.activeSessionId],
            messages: []
          };
          return { messages: [], sessions: updatedSessions };
        }
        return { messages: [] };
      });
    },
    
    clearHookEvents: () => {
      set({ hookEvents: [] });
    },
    
    clearJsonDebug: () => {
      set({ jsonDebugLog: [] });
    },
    
    setSessionId: (id: string | null) => {
      set({ sessionId: id });
    },
    
    setProcessing: (processing: boolean) => {
      set({ processing });
    },
    
    setSystemInfo: (info: { model?: string; tools?: string[]; cwd?: string }) => {
      set({ model: info.model || null });
    },
    
    updateTokenCount: (tokens: number) => {
      set((state) => ({ totalTokens: state.totalTokens + tokens }));
    },
    
    switchSession: (sessionId: string) => {
      set((state) => {
        const updatedSessions = { ...state.sessions };
        
        // Save current session state
        if (state.activeSessionId && state.activeSessionId !== sessionId) {
          updatedSessions[state.activeSessionId] = {
            id: state.activeSessionId,
            messages: state.messages,
            totalTokens: state.totalTokens,
            model: state.model,
            active: true,
            processing: state.processing,
            jsonDebugLog: state.jsonDebugLog,
            todos: state.todos
          };
        }
        
        // Load new session or create empty one
        const newSession = updatedSessions[sessionId] || {
          id: sessionId,
          messages: [],
          totalTokens: 0,
          model: null,
          active: true,
          processing: false,
          jsonDebugLog: [],
          todos: []
        };
        
        updatedSessions[sessionId] = newSession;
        
        return {
          sessions: updatedSessions,
          activeSessionId: sessionId,
          sessionId: sessionId,
          messages: newSession.messages,
          totalTokens: newSession.totalTokens,
          model: newSession.model,
          processing: newSession.processing,
          jsonDebugLog: newSession.jsonDebugLog,
          todos: newSession.todos
        };
      });
    },
    
    createSession: (sessionId: string) => {
      set((state) => ({
        sessions: {
          ...state.sessions,
          [sessionId]: {
            id: sessionId,
            messages: [],
            totalTokens: 0,
            model: null,
            active: true,
            processing: false,
            jsonDebugLog: [],
            todos: []
          }
        },
        activeSessionId: sessionId,
        sessionId: sessionId,
        messages: [],
        totalTokens: 0,
        model: null,
        processing: false,
        jsonDebugLog: [],
        todos: []
      }));
    },
    
    updateSessionMessages: (sessionId: string, messages: Message[]) => {
      set((state) => {
        const updatedSessions = { ...state.sessions };
        if (updatedSessions[sessionId]) {
          updatedSessions[sessionId].messages = messages;
        }
        
        // If this is the active session, update main state too
        if (state.activeSessionId === sessionId) {
          return {
            sessions: updatedSessions,
            messages
          };
        }
        
        return { sessions: updatedSessions };
      });
    },
    
    updateTodos: (todos: TodoItem[]) => {
      set((state) => {
        // Update todos in current state
        const updatedState: any = { todos };
        
        // Also update in the active session if it exists
        if (state.activeSessionId && state.sessions[state.activeSessionId]) {
          updatedState.sessions = { ...state.sessions };
          updatedState.sessions[state.activeSessionId] = {
            ...updatedState.sessions[state.activeSessionId],
            todos
          };
        }
        
        return updatedState;
      });
    }
  }));