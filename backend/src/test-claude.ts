import { spawn } from 'node-pty';

console.log('Testing Claude with --dangerously-skip-permissions...');

const pty = spawn('claude', ['--dangerously-skip-permissions'], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: '/tmp/test-project',
  env: process.env
});

let outputBuffer = '';

pty.onData((data) => {
  console.log('Output received:', data.length, 'bytes');
  console.log('First 200 chars:', data.substring(0, 200).replace(/\n/g, '\\n').replace(/\r/g, '\\r'));
  outputBuffer += data;
  
  // Check if ready
  if (data.includes('How can I help') || data.includes('└─')) {
    console.log('\nClaude is ready! Sending test message...');
    setTimeout(() => {
      pty.write('Hello Claude!\r');
    }, 500);
  }
});

pty.onExit(({ exitCode, signal }) => {
  console.log(`\nClaude exited with code ${exitCode}, signal ${signal}`);
  console.log('Total output length:', outputBuffer.length);
  process.exit(0);
});

// Exit after 10 seconds
setTimeout(() => {
  console.log('\nTimeout reached, killing Claude...');
  pty.kill();
}, 10000);