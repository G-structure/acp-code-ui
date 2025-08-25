import { spawn } from 'node-pty';
import { v4 as uuidv4 } from 'uuid';

console.log('Testing Claude Code JSON streaming with stdin...');

const sessionId = uuidv4();
console.log('Using session ID:', sessionId);

// Start claude with --print but reading from stdin (no initial prompt)
const pty = spawn('claude', [
  '--print',  // Non-interactive mode
  '--verbose',  // Required for stream-json with --print
  '--output-format', 'stream-json',
  '--input-format', 'stream-json',
  '--replay-user-messages',
  '--dangerously-skip-permissions',
  '--session-id', sessionId
  // No initial prompt - will send via stdin
], {
  name: 'xterm-256color',
  cols: 80,
  rows: 30,
  cwd: '/tmp',
  env: process.env
});

let messageBuffer = '';

pty.onData((data) => {
  console.log('Raw output:', data.substring(0, 200));
  messageBuffer += data;
  
  // Try to parse JSON messages line by line
  const lines = messageBuffer.split('\n');
  messageBuffer = lines.pop() || ''; // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        console.log('Parsed message type:', message.type);
        
        if (message.type === 'system' && message.subtype === 'init') {
          console.log('\nSystem initialized, sending first message...');
          // Send first message via stdin
          const userMessage = {
            type: 'user_message',
            message: 'Hello from stdin!'
          };
          pty.write(JSON.stringify(userMessage) + '\n');
        }
        
        if (message.type === 'assistant') {
          console.log('\nGot assistant response, sending follow-up...');
          // Send follow-up message
          const followUp = {
            type: 'user_message',
            message: 'Can you write a simple hello world in Python?'
          };
          pty.write(JSON.stringify(followUp) + '\n');
        }
      } catch (e) {
        console.log('Failed to parse line:', line.substring(0, 100));
      }
    }
  }
});

pty.onExit(({ exitCode, signal }) => {
  console.log(`\nClaude exited with code ${exitCode}, signal ${signal}`);
  process.exit(0);
});

// Exit after 15 seconds
setTimeout(() => {
  console.log('\nTimeout reached, killing Claude...');
  pty.kill();
}, 15000);