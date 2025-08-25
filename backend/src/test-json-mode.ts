import { spawn } from 'node-pty';
import { v4 as uuidv4 } from 'uuid';

console.log('Testing Claude Code JSON streaming mode...');

const sessionId = uuidv4();
console.log('Using session ID:', sessionId);

const pty = spawn('claude', [
  '--print',  // Non-interactive mode
  '--verbose',  // Required for stream-json with --print
  '--output-format', 'stream-json',
  '--input-format', 'stream-json',
  '--replay-user-messages',
  '--dangerously-skip-permissions',
  '--session-id', sessionId,
  'Hello, can you help me with coding?'  // Initial prompt as argument
], {
  name: 'xterm-256color',
  cols: 80,
  rows: 30,
  cwd: '/tmp',
  env: process.env
});

let messageBuffer = '';

pty.onData((data) => {
  console.log('Raw output:', data);
  messageBuffer += data;
  
  // Try to parse JSON messages line by line
  const lines = messageBuffer.split('\n');
  messageBuffer = lines.pop() || ''; // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        console.log('Parsed JSON message:', message);
      } catch (e) {
        console.log('Failed to parse line:', line);
      }
    }
  }
});

pty.onExit(({ exitCode, signal }) => {
  console.log(`\nClaude exited with code ${exitCode}, signal ${signal}`);
  process.exit(0);
});

// Don't send message since it's provided as argument

// Exit after 10 seconds
setTimeout(() => {
  console.log('\nTimeout reached, killing Claude...');
  pty.kill();
}, 10000);