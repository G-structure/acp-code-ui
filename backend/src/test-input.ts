import { spawn } from 'node-pty';

console.log('Testing Claude input methods...');

const pty = spawn('claude', ['--dangerously-skip-permissions'], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: '/tmp/test-project',
  env: process.env
});

let ready = false;

pty.onData((data) => {
  console.log('Output:', data.substring(0, 200).replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\x1b/g, '\\x1b'));
  
  if (!ready && data.includes('│ >')) {
    ready = true;
    console.log('\nClaude is ready! Testing different input methods...\n');
    
    // Test 1: Just text with \r
    setTimeout(() => {
      console.log('Test 1: Sending "Hello" with \\r');
      pty.write('Hello\r');
    }, 1000);
    
    // Test 2: Try Ctrl+Enter (Ctrl+J)
    setTimeout(() => {
      console.log('Test 2: Sending Ctrl+J (\\x0a)');
      pty.write('\x0a');
    }, 2000);
    
    // Test 3: Try Ctrl+D (EOF)
    setTimeout(() => {
      console.log('Test 3: Sending Ctrl+D (\\x04)');
      pty.write('\x04');
    }, 3000);
    
    // Test 4: Try ESC then Enter
    setTimeout(() => {
      console.log('Test 4: Sending ESC + Enter');
      pty.write('\x1b\r');
    }, 4000);
    
    // Test 5: Try double Enter
    setTimeout(() => {
      console.log('Test 5: Sending double Enter');
      pty.write('\r\r');
    }, 5000);
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