# Current Architecture

## System Overview

The Claude Code Web UI is a **bridge application** that transforms Claude Code CLI from a terminal-based TUI into a modern web interface. It maintains the same underlying capabilities while providing enhanced user experience through real-time streaming, session management, and web-based file operations.

### Core Design Principles
- **Event-Driven Architecture**: Loose coupling through Node.js EventEmitter
- **Process Isolation**: Each Claude interaction spawns a new process
- **Real-time Streaming**: WebSocket-based bidirectional communication
- **Session Persistence**: Automatic conversation history management
- **Security Model**: Inherits Claude Code's `--dangerously-skip-permissions` mode

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Browser                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   React Frontend│  │ WebSocket Client│  │  File Explorer  │  │
│  │   (Port 3000)   │  │   (Port 3002)   │  │   (REST API)    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Server (Node.js)                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Express Server │  │WebSocket Server │  │  File System    │  │
│  │   (Port 3001)   │  │   (Port 3002)   │  │     API         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           ↕                    ↕                    ↕           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Claude Manager  │  │  Hook Server    │  │  Route Modules  │  │
│  │   (JSON Mode)   │  │  (Event Capture)│  │  (REST Routes)  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Code CLI                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Process Spawn  │  │  JSON Streaming │  │  Tool Execution │  │
│  │   (node-pty)    │  │   (--print)     │  │  (Unrestricted) │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Real-Time Communication Flow

### Primary Communication Path
```
Browser (Frontend) 
    ↕ WebSocket (port 3002)
Backend (Express + WebSocket Server)
    ↕ Process Spawning (node-pty)
Claude Code CLI
    ↕ JSON Stream Parsing
Backend Event System
    ↕ WebSocket Broadcasting
Browser (Real-time Updates)
```

### Secondary Communication Paths
```
Browser (File Operations)
    ↕ REST API (port 3001)
Backend File System API
    ↕ Node.js fs/promises
Local File System

Browser (Voice Input)
    ↕ REST API (port 3001)
Backend Voice Router
    ↕ Local Whisper Server (port 9000)
    ↕ OpenAI Whisper API (fallback)
```

## Detailed Component Architecture

### Frontend Layer (React + TypeScript)
```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Components                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  ChatInterface  │  │  CodeEditor     │  │  FileExplorer   │  │
│  │  - Message List │  │  - Monaco Editor│  │  - File Tree    │  │
│  │  - Input Form   │  │  - Syntax High. │  │  - @ Mentions   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  TodoPanel      │  │  ToolResultBlock│  │  JsonDebugViewer│  │
│  │  - Live Updates │  │  - Tool Output  │  │  - Raw JSON     │  │
│  │  - Persistence  │  │  - Formatting   │  │  - Debugging    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                ↕
┌─────────────────────────────────────────────────────────────────┐
│                      State Management                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Zustand Store  │  │  WebSocket Hook │  │  Voice Input    │  │
│  │  - Sessions     │  │  - Real-time    │  │ - Speech-to-Text│  │
│  │  - Messages     │  │  - Reconnection │  │ - Audio Capture │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Backend Layer (Node.js + Express)
```
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Core                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  index.ts       │  │  WebSocket      │  │  Event System   │  │
│  │  - Express App  │  │  - Real-time    │  │ - Broadcasting  │  │
│  │  - Route Setup  │  │  - Message      │  │ - Error Handling│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Service Layer                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ClaudeCodeManager│  │  HookServer     │  │  FileSystemAPI  │  │
│  │  - Process Mgmt │  │  - Event Capture│  │  - File Ops     │  │
│  │  - JSON Parsing │  │  - Tool Blocking│  │  - Search       │  │
│  │  - Session Mgmt │  │  - History      │  │  - Metadata     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Route Modules                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │directory-history│  │  voice.ts       │  │  REST Endpoints │  │
│  │ - Recent Dirs   │  │  - Whisper API  │  │  - File Ops     │  │
│  │ - Session Import│  │  - Audio Trans. │  │  - Markdown     │  │
│  │ - JSON Export   │  │  - Local Server │  │  - Session Mgmt │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │ 
└─────────────────────────────────────────────────────────────────┘
```

## Process Management & Claude Code Integration

### Claude Code Process Lifecycle
```
1. Session Initialization
   ├── Generate UUID for session
   ├── Set working directory
   └── Emit 'session-started' event

2. Message Processing
   ├── Spawn new Claude process with flags:
   │   ├── --print (non-interactive)
   │   ├── --verbose (required for JSON)
   │   ├── --output-format stream-json
   │   ├── --dangerously-skip-permissions
   │   └── --session-id or --continue
   ├── Parse JSON stream line-by-line
   ├── Emit structured events
   └── Clean up process on completion

3. Session Persistence
   ├── Log to .claude-debug/session-{id}.json
   ├── Store user prompts and responses
   └── Maintain conversation history
```

### Claude Code Command Line Arguments
```bash
# New Session (First Message)
claude --print --verbose --output-format stream-json --dangerously-skip-permissions --session-id {uuid} "{prompt}"

# Existing Session (Subsequent Messages)
claude --print --verbose --output-format stream-json --dangerously-skip-permissions --continue "{prompt}"

# Shadow Process (Conversation Summarization)
claude --print --verbose --output-format stream-json --dangerously-skip-permissions "{summary_prompt}"
```

## Message Types & JSON Stream Parsing

### Claude Code JSON Output Structure
The backend parses Claude's JSON stream and emits different event types:

#### System Messages
```json
{
  "type": "system",
  "subtype": "init",
  "session_id": "uuid",
  "model": "claude-3-5-sonnet-20241022",
  "tools": ["read_file", "write_file", "run_terminal_cmd", ...],
  "cwd": "/path/to/working/directory"
}
```

#### User Messages
```json
{
  "type": "user",
  "message": {
    "content": [
      {"type": "text", "text": "User prompt"},
      {"type": "tool_result", "tool_use_id": "id", "content": "result"}
    ]
  }
}
```

#### Assistant Messages
```json
{
  "type": "assistant",
  "message": {
    "content": [
      {"type": "thinking", "text": "Internal reasoning..."},
      {"type": "text", "text": "Response to user"},
      {"type": "tool_use", "name": "read_file", "input": {...}}
    ],
    "model": "claude-3-5-sonnet-20241022",
    "usage": {"input_tokens": 100, "output_tokens": 50}
  }
}
```

#### Tool Messages
```json
{
  "type": "tool_result",
  "tool_name": "read_file",
  "tool_result": "File contents..."
}
```

#### Error Messages
```json
{
  "type": "error",
  "error": "Error message"
}
```

## WebSocket Communication Protocol

The WebSocket communication system provides real-time bidirectional messaging between the frontend and backend. All messages are JSON-encoded and follow a consistent structure.

### Connection Details
- **URL**: `ws://localhost:3002` (or `wss://` for HTTPS)
- **Protocol**: WebSocket with JSON message format
- **Keep-Alive**: Ping/pong every 25-30 seconds
- **Reconnection**: Automatic with exponential backoff

---

## Frontend → Backend Messages

### Session Management

#### Start Session
```json
{
  "type": "start-session",
  "workingDirectory": "/path/to/project",
  "sessionId": "optional-uuid",
  "isNewSession": true
}
```
**Description**: Initialize a new Claude Code session or resume an existing one.

**Fields**:
- `workingDirectory` (optional): Working directory for the session. Defaults to current directory.
- `sessionId` (optional): Specific session ID to resume. If not provided, creates new session.
- `isNewSession` (optional): Whether this is a new session (true) or resuming existing (false).

**Response**: `session-started` or `error`

#### Stop Session
```json
{
  "type": "stop-session"
}
```
**Description**: Terminate the current Claude Code session and clean up resources.

**Response**: `session-stopped`

### Message Communication

#### Send Prompt
```json
{
  "type": "send-prompt",
  "prompt": "User message to Claude",
  "markdownFiles": ["file1.md", "file2.md"]
}
```
**Description**: Send a user message to Claude Code for processing.

**Fields**:
- `prompt` (required): The user's message/prompt to send to Claude.
- `markdownFiles` (optional): Array of markdown file paths to include as system prompt.

**Features**:
- **Debouncing**: Rapid sends (< 500ms apart) are ignored to prevent spam.
- **Markdown Integration**: Selected markdown files are automatically included as context.
- **Session Persistence**: Message is logged to session history.

**Response**: Various message types as Claude processes the request.

#### Send Command
```json
{
  "type": "send-command",
  "command": "terminal command"
}
```
**Description**: Send a direct command to Claude Code (legacy support).

**Note**: This is not used in JSON mode but maintained for compatibility.

### Process Control

#### Stop Process
```json
{
  "type": "stop-process"
}
```
**Description**: Interrupt the current Claude process without ending the session.

**Use Cases**:
- User wants to stop a long-running response
- Process is taking too long
- User wants to send a new message

**Response**: `process-stopped`

### Keep-Alive

#### Ping
```json
{
  "type": "ping"
}
```
**Description**: Keep-alive message to maintain WebSocket connection.

**Response**: `pong`

**Frequency**: Sent every 25 seconds by frontend, server responds with pong.

---

## Backend → Frontend Messages

### Chat Messages

#### Chat Message
```json
{
  "type": "chat-message",
  "message": {
    "id": "unique-message-id",
    "type": "assistant|user|thinking|tool_use|tool_result",
    "content": "Message content",
    "streaming": true,
    "tokens": 150,
    "model": "claude-3-5-sonnet-20241022",
    "timestamp": 1704067200000,
    "tool_name": "read_file",
    "tool_input": {...},
    "tool_result": "..."
  }
}
```
**Description**: New chat message from any source (user, assistant, tools).

**Message Types**:
- `assistant`: Claude's response to user
- `user`: Echo of user input (rare in JSON mode)
- `thinking`: Claude's internal reasoning process
- `tool_use`: Tool execution request
- `tool_result`: Tool execution result

**Fields**:
- `id`: Unique identifier for the message
- `type`: Type of message (see above)
- `content`: Text content of the message
- `streaming`: Whether this message is being streamed (true/false)
- `tokens`: Token count for the message (if available)
- `model`: Claude model used (if available)
- `timestamp`: Message timestamp in milliseconds
- `tool_name`: Name of tool being used (for tool messages)
- `tool_input`: Input parameters for tool (for tool messages)
- `tool_result`: Result from tool execution (for tool result messages)

#### Chat Message Update
```json
{
  "type": "chat-message-update",
  "data": {
    "id": "message-id",
    "content": "Updated streaming content",
    "model": "claude-3-5-sonnet-20241022",
    "usage": {
      "output_tokens": 200
    }
  }
}
```
**Description**: Update to an existing streaming message.

**Use Cases**:
- Real-time streaming of Claude's response
- Progressive content updates
- Token usage updates during streaming

#### Chat Message Finalize
```json
{
  "type": "chat-message-finalize",
  "data": {
    "id": "message-id"
  }
}
```
**Description**: Signal that a streaming message is complete.

**Use Cases**:
- End of Claude's response streaming
- Process completion
- Final message state

### System Information

#### System Info
```json
{
  "type": "system-info",
  "data": {
    "model": "claude-3-5-sonnet-20241022",
    "tools": ["read_file", "write_file", "run_terminal_cmd", ...],
    "cwd": "/path/to/working/directory",
    "sessionId": "claude-session-id"
  }
}
```
**Description**: System information from Claude Code initialization.

**Fields**:
- `model`: Claude model being used
- `tools`: Available tools for Claude
- `cwd`: Current working directory
- `sessionId`: Claude's internal session ID

#### Token Usage
```json
{
  "type": "token-usage",
  "data": {
    "input_tokens": 1000,
    "output_tokens": 500,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 0
  }
}
```
**Description**: Token usage information for the current conversation.

**Fields**:
- `input_tokens`: Tokens used for input
- `output_tokens`: Tokens used for output
- `cache_creation_input_tokens`: Tokens used for cache creation
- `cache_read_input_tokens`: Tokens read from cache

### Session Management

#### Session Started
```json
{
  "type": "session-started",
  "data": {
    "sessionId": "session-uuid"
  }
}
```
**Description**: Confirmation that a session has been started.

**Fields**:
- `sessionId`: The session ID that was created or resumed

#### Session Stopped
```json
{
  "type": "session-stopped"
}
```
**Description**: Confirmation that a session has been stopped.

#### Session ID Changed
```json
{
  "type": "session-id-changed",
  "data": {
    "oldId": "original-session-id",
    "newId": "claude-generated-session-id"
  }
}
```
**Description**: Notification when Claude changes the session ID.

**Use Cases**:
- Claude generates its own session ID
- Session ID mapping between frontend and Claude
- Session continuity across ID changes

### Process Status

#### Ready
```json
{
  "type": "ready"
}
```
**Description**: Claude is ready to accept new input.

**Use Cases**:
- Session initialization complete
- Previous process finished
- System ready for new requests

#### Process Stopped
```json
{
  "type": "process-stopped"
}
```
**Description**: Current Claude process has been stopped.

**Use Cases**:
- User interrupted the process
- Process completed normally
- Error occurred and process was terminated

### Tool Integration

#### Tool Use
```json
{
  "type": "tool-use",
  "data": {
    "tool": "read_file",
    "input": {
      "file_path": "/path/to/file.txt"
    }
  }
}
```
**Description**: Tool execution request from Claude.

**Fields**:
- `tool`: Name of the tool being used
- `input`: Input parameters for the tool

#### Tool Result
```json
{
  "type": "tool-result",
  "data": {
    "tool": "read_file",
    "output": "File contents..."
  }
}
```
**Description**: Result from tool execution.

**Fields**:
- `tool`: Name of the tool that was executed
- `output`: Result/output from the tool

#### Todo Update
```json
{
  "type": "todo-update",
  "data": {
    "todos": [
      {
        "id": "1",
        "content": "Task description",
        "status": "pending|in_progress|completed|cancelled"
      }
    ]
  }
}
```
**Description**: Todo list update from TodoWrite tool usage.

**Fields**:
- `todos`: Array of todo items with status updates

### Debug & Development

#### JSON Debug
```json
{
  "type": "json-debug",
  "data": {
    "raw": "Raw JSON string from Claude",
    "parsed": {
      "type": "assistant",
      "content": "Parsed message object"
    },
    "type": "markdown-system-prompt",
    "files": ["file1.md", "file2.md"],
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```
**Description**: Debug information for development and troubleshooting.

**Use Cases**:
- Raw Claude output for debugging
- Parsed message objects
- Markdown file inclusion logging
- Development diagnostics

#### Hook Event
```json
{
  "type": "hook-event",
  "event": {
    "type": "PreToolUse|PostToolUse|UserPromptSubmit|Notification|Stop",
    "timestamp": 1704067200000,
    "sessionId": "session-id",
    "data": {
      "tool_name": "read_file",
      "tool_input": {...}
    }
  }
}
```
**Description**: Hook event from Claude Code hook system.

**Event Types**:
- `PreToolUse`: Before tool execution
- `PostToolUse`: After tool execution
- `UserPromptSubmit`: When user submits prompt
- `Notification`: System notifications
- `Stop`: When Claude stops responding

### Keep-Alive

#### Pong
```json
{
  "type": "pong"
}
```
**Description**: Response to frontend ping message.

**Use Cases**:
- Keep-alive response
- Connection health check
- Latency measurement

### Error Handling

#### Error
```json
{
  "type": "error",
  "error": "Error message description"
}
```
**Description**: Error notification from backend.

**Common Error Types**:
- Session initialization failures
- Claude Code not installed
- Process execution errors
- WebSocket message parsing errors
- File system errors

---

## Message Flow Examples

### Typical Conversation Flow
```
1. Frontend → Backend: start-session
2. Backend → Frontend: session-started
3. Backend → Frontend: system-info
4. Backend → Frontend: ready
5. Frontend → Backend: send-prompt
6. Backend → Frontend: chat-message (thinking)
7. Backend → Frontend: chat-message (tool_use)
8. Backend → Frontend: tool-use
9. Backend → Frontend: tool-result
10. Backend → Frontend: chat-message (tool_result)
11. Backend → Frontend: chat-message (assistant, streaming)
12. Backend → Frontend: chat-message-update (multiple)
13. Backend → Frontend: chat-message-finalize
14. Backend → Frontend: token-usage
15. Backend → Frontend: ready
```

### Streaming Response Flow
```
1. Frontend → Backend: send-prompt
2. Backend → Frontend: chat-message (assistant, streaming: true)
3. Backend → Frontend: chat-message-update (content: "Hello")
4. Backend → Frontend: chat-message-update (content: "Hello, I can")
5. Backend → Frontend: chat-message-update (content: "Hello, I can help")
6. Backend → Frontend: chat-message-finalize
7. Backend → Frontend: ready
```

### Todo Update Flow
```
1. Frontend → Backend: send-prompt ("Create a todo list")
2. Backend → Frontend: chat-message (tool_use, TodoWrite)
3. Backend → Frontend: todo-update (todos array)
4. Backend → Frontend: chat-message (assistant response)
5. Backend → Frontend: ready
```

---

## Connection Management

### Connection States
- **Connecting**: Initial connection attempt
- **Connected**: WebSocket is open and ready
- **Disconnected**: Connection lost or closed
- **Reconnecting**: Attempting to reconnect

### Reconnection Logic
```
1. Connection lost → Wait 1 second
2. Attempt reconnection → If fails, wait 2 seconds
3. Retry → If fails, wait 4 seconds
4. Continue with exponential backoff up to 30 seconds
5. Maintain application state during reconnection
```

### Error Recovery
- **Message Queuing**: Failed sends are queued and retried
- **State Preservation**: Application state maintained during disconnection
- **Graceful Degradation**: Features degrade gracefully when connection is lost
- **Automatic Recovery**: Automatic reconnection without user intervention

## REST API Documentation

The backend provides a comprehensive REST API for file operations, session management, voice input, and system integration. All API endpoints are prefixed with `/api` except for health checks.

### Base URL
```
http://localhost:3001
```

### Authentication
- **No authentication required** (development environment only)
- All endpoints are publicly accessible
- ⚠️ **Security Warning**: Never expose to internet

---

## System & Health Endpoints

### Health Check
```http
GET /health
```
**Description**: Check if the backend server is running and healthy.

**Response**:
```json
{
  "status": "healthy"
}
```

---

## File System Operations

### List Files and Directories
```http
GET /api/files?path={directory_path}
```
**Description**: List files and directories in the specified path.

**Query Parameters**:
- `path` (optional): Directory path to list. Defaults to current working directory.

**Response**:
```json
[
  {
    "name": "filename.txt",
    "path": "/full/path/to/filename.txt",
    "type": "file",
    "size": 1024,
    "modified": "2024-01-01T00:00:00.000Z"
  },
  {
    "name": "directory",
    "path": "/full/path/to/directory",
    "type": "directory"
  }
]
```

**Error Response**:
```json
{
  "error": "Failed to list files",
  "message": "Error details",
  "path": "/requested/path"
}
```

### Read File Content
```http
GET /api/file-content?path={file_path}
```
**Description**: Read the contents of a specific file.

**Query Parameters**:
- `path` (required): Full path to the file to read.

**Response**:
```json
{
  "content": "File contents as string"
}
```

**Error Response**:
```json
{
  "error": "Failed to read file"
}
```

### Save File Content
```http
POST /api/save-file
```
**Description**: Write content to a file.

**Request Body**:
```json
{
  "path": "/full/path/to/file.txt",
  "content": "File contents to write"
}
```

**Response**:
```json
{
  "success": true
}
```

**Error Response**:
```json
{
  "error": "Failed to save file",
  "message": "Error details"
}
```

### List Markdown Files
```http
GET /api/markdown-files?path={directory_path}
```
**Description**: List all markdown files (.md, .markdown) in the specified directory.

**Query Parameters**:
- `path` (optional): Directory path to search. Defaults to current working directory.

**Response**:
```json
[
  {
    "name": "README.md",
    "path": "/full/path/to/README.md",
    "size": 2048,
    "modified": 1704067200000
  }
]
```

### Read Multiple Markdown Files
```http
POST /api/markdown-content
```
**Description**: Read the contents of multiple markdown files in a single request.

**Request Body**:
```json
{
  "files": [
    "/path/to/file1.md",
    "/path/to/file2.md"
  ]
}
```

**Response**:
```json
[
  {
    "path": "/path/to/file1.md",
    "name": "file1.md",
    "content": "File contents..."
  },
  {
    "path": "/path/to/file2.md",
    "name": "file2.md",
    "content": "File contents...",
    "error": "Error message if failed"
  }
]
```

---

## Session Management

### Get Session History
```http
GET /api/session-history?path={working_directory}&sessionId={session_id}
```
**Description**: Retrieve session history from `.claude-debug` directory.

**Query Parameters**:
- `path` (optional): Working directory containing `.claude-debug` folder. Defaults to current working directory.
- `sessionId` (optional): Specific session ID to load. If not provided, returns list of all sessions.

**Response (List Sessions)**:
```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "claudeSessionId": "claude-generated-id",
      "fileSessionId": "file-based-id",
      "firstTimestamp": 1704067200000,
      "lastTimestamp": 1704067800000,
      "messageCount": 25,
      "lastUserPrompt": "User's last message..."
    }
  ],
  "messages": []
}
```

**Response (Load Specific Session)**:
```json
{
  "sessions": ["session-uuid"],
  "messages": [
    {
      "timestamp": "2024-01-01T00:00:00.000Z",
      "type": "user",
      "prompt": "User message"
    },
    {
      "timestamp": "2024-01-01T00:01:00.000Z",
      "parsed": {
        "type": "assistant",
        "content": "Assistant response"
      }
    }
  ]
}
```

### Compact Conversation
```http
POST /api/compact-conversation
```
**Description**: Summarize a long conversation using a shadow Claude process.

**Request Body**:
```json
{
  "sessionId": "session-uuid",
  "workingDirectory": "/path/to/project"
}
```

**Response**:
```json
{
  "success": true,
  "summary": "Conversation summary generated by Claude..."
}
```

**Error Response**:
```json
{
  "error": "Failed to compact conversation",
  "message": "Error details"
}
```

---

## Directory History Management

### Get Directory History
```http
GET /api/directory-history
```
**Description**: Retrieve recently used working directories.

**Response**:
```json
{
  "directories": [
    {
      "path": "/path/to/project1",
      "lastUsed": "2024-01-01T00:00:00.000Z",
      "sessionCount": 5
    },
    {
      "path": "/path/to/project2",
      "lastUsed": "2024-01-01T01:00:00.000Z",
      "sessionCount": 3
    }
  ]
}
```

### Add Directory to History
```http
POST /api/directory-history
```
**Description**: Add or update a directory in the recent directories list.

**Request Body**:
```json
{
  "path": "/path/to/project"
}
```

**Response**:
```json
{
  "directories": [
    {
      "path": "/path/to/project",
      "lastUsed": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Import JSON Session
```http
POST /api/load-json-session
```
**Description**: Import and process a JSON session file.

**Request Body**:
```json
{
  "jsonData": [
    {
      "type": "user",
      "prompt": "User message",
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    {
      "parsed": {
        "type": "assistant",
        "message": {
          "content": "Assistant response"
        }
      }
    }
  ],
  "sessionId": "optional-session-id"
}
```

**Response**:
```json
{
  "success": true,
  "messages": [
    {
      "id": "imported-1234567890-0.123",
      "type": "user",
      "content": "User message",
      "timestamp": 1704067200000
    },
    {
      "id": "imported-1234567890-0.456",
      "type": "assistant",
      "content": "Assistant response",
      "tokens": 50,
      "model": "claude-3-5-sonnet-20241022",
      "timestamp": 1704067260000
    }
  ],
  "messageCount": 2
}
```

---

## Voice Input Integration

### Check Voice Service Status
```http
GET /api/voice/check
```
**Description**: Check if the local Whisper server is available and responding.

**Response**:
```json
{
  "enabled": true,
  "message": "Local voice input available"
}
```

**Error Response**:
```json
{
  "enabled": false,
  "message": "Local Whisper server not available"
}
```

### Transcribe Audio
```http
POST /api/voice/transcribe
```
**Description**: Transcribe audio file using local Whisper server.

**Request**: Multipart form data with audio file
- `audio`: Audio file (max 25MB, supports .webm, .mp3, .wav, etc.)

**Response**:
```json
{
  "text": "Transcribed text from audio",
  "success": true
}
```

**Error Response**:
```json
{
  "error": "Failed to transcribe audio",
  "details": "Error details"
}
```

**Supported Audio Formats**:
- WebM (.webm)
- MP3 (.mp3)
- WAV (.wav)
- OGG (.ogg)
- FLAC (.flac)

---

## Hook System Integration

### Send Hook Event
```http
POST /api/hooks/{event_type}
```
**Description**: Send a hook event to the Claude Code hook system.

**Path Parameters**:
- `event_type`: Type of hook event (e.g., `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Notification`, `Stop`)

**Request Body**:
```json
{
  "tool_name": "read_file",
  "tool_input": {
    "file_path": "/path/to/file.txt"
  },
  "tool_id": "optional-tool-id"
}
```

**Response**:
```json
{
  "status": "received"
}
```

**Supported Hook Events**:
- `PreToolUse`: Before tool execution
- `PostToolUse`: After tool execution
- `UserPromptSubmit`: When user submits prompt
- `Notification`: System notifications
- `Stop`: When Claude stops responding

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": "Error message",
  "message": "Detailed error description",
  "details": "Additional error context"
}
```

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (missing required parameters)
- `500`: Internal Server Error
- `413`: Payload Too Large (file size limits)

### Common Error Scenarios
1. **File Not Found**: When requesting non-existent files
2. **Permission Denied**: When lacking file system permissions
3. **Invalid Path**: When providing malformed file paths
4. **Session Not Found**: When requesting non-existent sessions
5. **Whisper Server Unavailable**: When voice service is down
6. **File Size Exceeded**: When uploading files larger than 25MB

---

## Rate Limiting & Performance

### File Size Limits
- **Audio Files**: 25MB maximum
- **Text Files**: No explicit limit (limited by available memory)
- **Session Files**: No explicit limit

### Concurrent Requests
- **No rate limiting implemented** (development environment)
- **File operations**: Limited by Node.js event loop
- **Voice transcription**: Limited by Whisper server capacity

### Performance Considerations
- **File listing**: ~10-100ms for typical directories
- **File reading**: ~1-10ms for small files
- **Voice transcription**: ~1-30 seconds depending on audio length
- **Session loading**: ~100-500ms for typical sessions

### Session Persistence
```
Location: {workingDirectory}/.claude-debug/session-{id}.json
Format:   One JSON object per line (newline-delimited JSON)
Content:  User prompts, assistant responses, tool usage, metadata
```

## Security Model & Considerations

### Current Security Model
- **Inherits Claude Code's `--dangerously-skip-permissions` mode**
- **Unrestricted file system access**
- **No authentication or authorization**
- **No input sanitization**
- **Process isolation per message**

### Security Implications
```
⚠️  CRITICAL SECURITY WARNINGS ⚠️

1. File System Access
   - Claude can read/write/delete ANY file
   - No permission prompts or confirmations
   - Full access to user's home directory

2. Command Execution
   - Claude can run ANY command
   - No sandboxing or restrictions
   - Direct access to system resources

3. Network Access
   - Claude can make network requests
   - No firewall or proxy restrictions
   - Full internet access

4. Process Management
   - Claude can spawn additional processes
   - No resource limits or quotas
   - Can modify system configuration
```

### Recommended Usage
- **Development environments only**
- **Dedicated development machines**
- **Never expose to internet**
- **Use in isolated networks**
- **Regular backups of important data**

## Performance Characteristics

### Memory Usage
- **Frontend**: ~50-100MB (React + Monaco Editor)
- **Backend**: ~20-50MB (Node.js + Express)
- **Claude Processes**: ~100-200MB per active session

### Network Traffic
- **WebSocket**: ~1-10KB per message
- **File Operations**: Variable (file size dependent)
- **Voice Input**: ~1-25MB per audio file

### Latency
- **Message Processing**: 100-500ms (Claude response time)
- **File Operations**: 10-100ms (local filesystem)
- **WebSocket Updates**: <10ms (real-time streaming)

## Error Handling & Recovery

### Connection Recovery
```
WebSocket Disconnection
├── Automatic reconnection (1-3 second intervals)
├── State preservation during reconnection
├── Message queuing for failed sends
└── Graceful degradation of features
```

### Process Error Handling
```
Claude Process Failures
├── Automatic cleanup of zombie processes
├── Error message propagation to frontend
├── Session state preservation
└── Retry mechanisms for transient failures
```

### File System Errors
```
File Operation Failures
├── Permission error handling
├── Path validation and sanitization
├── Graceful fallbacks for missing files
└── User-friendly error messages
```

## Development & Testing Infrastructure

### Test Files
- **`test-json-mode.ts`**: JSON streaming functionality
- **`test-input.ts`**: Input method validation
- **`test-pty.ts`**: Pseudo-terminal operations
- **`test-sequences.ts`**: Command sequence testing
- **`test-stdin-json.ts`**: JSON input via stdin

### Logging System
```
Log Levels: debug, info, warn, error
Outputs:   Console (colored), error.log, combined.log
Format:    JSON with timestamps and metadata
Rotation:  Manual (no automatic log rotation)
```

### Development Workflow
```
1. Backend Development
   ├── TypeScript compilation (tsc)
   ├── Hot reload (tsx watch)
   └── Process management (nodemon)

2. Frontend Development
   ├── Vite dev server
   ├── Hot module replacement
   └── TypeScript checking

3. Integration Testing
   ├── WebSocket connection testing
   ├── Claude Code integration
   └── End-to-end message flow
```

This architecture provides a robust, real-time bridge between modern web technologies and Claude Code's powerful CLI capabilities, while maintaining the flexibility and power of the underlying system.

# Key Design Patterns
1. Event-Driven Architecture: Uses Node.js EventEmitter for loose coupling
2. Process Management: Spawns Claude Code as child processes using node-pty
3. Stream Processing: Parses JSON streams line-by-line for real-time updates
4. Session Persistence: Stores conversation history in .claude-debug/ directories
5. Modular Routing: Separates concerns into focused route modules

The backend essentially acts as a translation layer between the web interface and Claude Code CLI, converting web requests into CLI commands and streaming responses back to the browser in real-time.