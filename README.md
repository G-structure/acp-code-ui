# Basic & Clean Claude Code (web) UI

A (very) dark mode web interface for Claude Code TUI that provides a more interactive experience for AI-assisted coding with Claude. I injured my left hand was annoyed with linux speech-to-text options so I wanted a way things could be edited and cut and pasted easier - the rest snowballed from there.

Still missing some features, but is usable enough (have been using it 90% of the time compared to the standard TUI with few real issues).

I wanted to focus on only what matters and is helpful and not just crowd it with "stuff" like some other similar tools.

![screenshot](https://raw.githubusercontent.com/ryrobes/claude-code-ui/refs/heads/main/Screenshot_2025-08-27_01-21-58.png)


### Persistent TODO panel

Intercepts TODOs and keeps them in a side panel instead of only being in the chat log.

### Selective 'system prompt' injection on a per-message basis

Have special handling that is situational? Drop down shows all .md files in the working directory that you can sub in and out to be sent with the next message (example: I have special instructions on handling Clojure paren matching issues with tool explanations, etc - but I don't want that all in my context all the time, just when I need it)

### On API calls

> The app assumes that you will want to use a subscription and not the much more expensive per token API access - but Clade in JSON mode will use the API tokens by default unless ANTHROPIC_API_KEY is unset. 

> So be aware, if ANTHROPIC_API_KEY is populated it will be used by default. My start.sh script unsets it just in case - but if you love to spend money (rather than use a Claude MAX sub, etc), feel free to comment that out!

### On compacting

> The JSON mode I use for a call-and-response doesn't support `/compact`, so when you reach the end of the context window (200k for Claude subs, higher for API calls) you will get presented with a button that takes the existing convo - runs a background clause session to summarize it - opens a new user session and dumps the output to the "first message" text window so it can be edited before you send it.

> It will then attempt to copy over the message history to give the user context about what came before (even though it's not actually in the current context window, only the summarization on).




## ☠️ IMPORTANT SECURITY NOTE ☠️

**This application runs in `--dangerously-skip-permissions` mode AT ALL TIMES**

This means:
- Claude has **UNRESTRICTED ACCESS** to your file system
- Claude can execute **ANY COMMAND** without asking for permission
- Claude can read, write, and delete **ANY FILE** on your system
- Claude can run potentially destructive operations without confirmation
- Better be nice to Claude or his `rm -rf *` finger might get itchy

**USE AT YOUR OWN RISK**

> This is intended for development environments. Perhaps even on a dedicated "raw dog" server via SSH, if that's how you want to roll.

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
- Click microphone button to record, transcription appears in message input
- Needs a local (to the browser) docker instance running whisper-as-a-service at 9k - i.e.
```
docker rm -f whisper-rest 2>/dev/null || true && docker run -p 9000:9000   -e ASR_MODEL=large-v3   -e ASR_ENGINE=faster_whisper   --name whisper-rest   onerahmet/openai-whisper-asr-webservice
## CPU only
```

```
docker rm -f whisper-rest 2>/dev/null || true && docker run --gpus all -p 9000:9000 \
  -e ASR_MODEL=large-v3 \
  -e ASR_ENGINE=openai_whisper \
  -v $PWD/cache:/root/.cache \
  --name whisper-rest \
  onerahmet/openai-whisper-asr-webservice:v1.7.1-gpu ## CUDA 11.x of latest-gpu for CUDA 12.6
## with GPU
```

(CPU still works great, albiet much slower)

### Developer Features
- **JSON debug viewer** - Inspect raw JSON messages from Claude
- **Hook event monitor** - Track Claude Code hook events
- **Session history** - Load previous sessions from `.claude-debug` directory
- **Directory history** - Quick access to recently used working directories

## Prerequisites

- Node.js 18+ and npm
- Claude Code CLI installed and authenticated

## Installation

```bash
# Clone the repository
git clone https://github.com/ryrobes/claude-code-ui.git
cd claude-code-ui

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
# From the claude-code-ui directory
./start.sh
```

or bind to a specific IP

```bash
./start.sh 0.0.0.0
````

The application will start:
- Backend on http://localhost:3001
- Frontend on http://localhost:3000

### Stopping the Application

```bash
./stop.sh
```

Or press `Ctrl+C` in the terminal where you started the application.

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

Use at your own risk. This tool provides unrestricted system access to an AI assistant. MIT or whatever.

---

**Remember**: This tool runs in dangerous mode by design. Always review Claude's actions and maintain backups of important data.