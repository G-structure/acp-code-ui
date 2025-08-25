# Claude Code Web UI

A modern web interface for Claude Code TUI that provides a rich, interactive experience for AI-assisted coding with Claude.

## ⚠️ IMPORTANT SECURITY NOTICE ⚠️

**This application runs in `--dangerously-skip-permissions` mode AT ALL TIMES**

This means:
- Claude has **UNRESTRICTED ACCESS** to your file system
- Claude can execute **ANY COMMAND** without asking for permission
- Claude can read, write, and delete **ANY FILE** on your system
- Claude can run potentially destructive operations without confirmation

**USE AT YOUR OWN RISK** - This mode is intended for development environments only.

## Features

### Core Functionality
- **Web-based interface** for Claude Code TUI with real-time streaming responses
- **Pre-authenticated sessions** - Uses your existing Claude Code authentication (no API key needed)
- **JSON streaming mode** - Reliable message parsing without terminal animation issues
- **Session persistence** - Maintains conversation context across messages
- **Multi-session support** - Tab-based session management with history

### UI Features
- **Dark cyberpunk theme** - Black background with cyan/magenta accents
- **File explorer** with @ mentions - Browse and select files to include in context
- **Directory selection mode** - Switch between file browsing and directory selection
- **Todo panel** - Live tracking of Claude's tasks (automatically parsed from TodoWrite tool usage)
- **Message filtering** - Toggle visibility of different message types:
  - User messages
  - Assistant responses
  - Thinking blocks
  - Tool usage
  - Tool results
- **Token counter** - Real-time display of context token usage
- **Multi-line input** - Shift+Enter for new lines, Enter to send

### Voice Input (Optional)
- **Speech-to-text** using OpenAI Whisper API
- Automatically enabled when `OPENAI_API_KEY` environment variable is set
- Click microphone button to record, transcription appears in message input

### Developer Features
- **JSON debug viewer** - Inspect raw JSON messages from Claude
- **Hook event monitor** - Track Claude Code hook events
- **Session history** - Load previous sessions from `.claude-debug` directory
- **Directory history** - Quick access to recently used working directories

## Prerequisites

- Node.js 18+ and npm
- Claude Code CLI installed and authenticated
- (Optional) OpenAI API key for voice input features

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd claude-code-web-ui

# Install dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies  
cd frontend
npm install
cd ..
```

## Usage

### Starting the Application

```bash
# From the claude-code-web-ui directory
./start.sh
```

The application will start:
- Backend on http://localhost:3001
- Frontend on http://localhost:3000

### Stopping the Application

```bash
./stop.sh
```

Or press `Ctrl+C` in the terminal where you started the application.

### Enabling Voice Input

Set your OpenAI API key as an environment variable:

```bash
export OPENAI_API_KEY="your-api-key-here"
```

The microphone button will automatically appear in the chat interface when the key is detected.

## Architecture

### Backend (`/backend`)
- **Express + TypeScript** server with WebSocket support
- **claude-code-manager-json.ts** - Spawns Claude processes in JSON streaming mode
- **Voice API** - Handles audio transcription via OpenAI Whisper
- **File system API** - Provides file browsing capabilities
- **Session persistence** - Stores conversation history in `.claude-debug` directories

### Frontend (`/frontend`)
- **React + TypeScript** with Material-UI components
- **Zustand** for state management
- **WebSocket hook** for real-time communication
- **Voice input hook** for browser microphone access
- **Markdown rendering** with syntax highlighting

### Key Implementation Details

- Each message spawns a new Claude process with `--print` flag (non-interactive mode)
- First message uses `--session-id`, subsequent messages use `--resume`
- Messages are deduplicated by ID to prevent duplicates during streaming
- Timestamps are updated when messages are finalized to maintain correct ordering
- Todo items are extracted from TodoWrite tool usage and displayed in real-time

## Session Management

Sessions are automatically saved to `.claude-debug/session-{id}.json` files in your working directory. You can:
- Switch between sessions using the tab interface
- Load previous sessions by clicking on them
- Import JSON session files via the menu

## Security Considerations

This application is designed for **LOCAL DEVELOPMENT USE ONLY**:

- Runs with unrestricted file system access
- No authentication or authorization
- No input sanitization for Claude commands
- Exposes your file system via the web interface
- Should never be exposed to the internet

## Troubleshooting

### Microphone not working
1. Check browser permissions (click lock icon in address bar)
2. Ensure HTTPS or localhost (required for getUserMedia API)
3. Verify microphone is not in use by another application

### Messages not appearing
1. Check WebSocket connection status (should show "Connected")
2. Verify Claude Code is properly authenticated
3. Check browser console for errors

### High token usage
- Use message filtering to hide tool usage/thinking messages
- Clear chat history when starting new topics
- Use separate sessions for different tasks

## Contributing

This is an experimental tool for development use. Contributions should focus on:
- Improving security warnings and safeguards
- Enhancing the development experience
- Adding helpful developer features
- Improving error handling and user feedback

## License

Use at your own risk. This tool provides unrestricted system access to an AI assistant.

---

**Remember**: This tool runs in dangerous mode by design. Always review Claude's actions and maintain backups of important data.