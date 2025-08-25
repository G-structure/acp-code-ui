import { spawn } from 'node-pty';

console.log('Testing different submit sequences for Claude Code...');

const sequences = [
  { name: 'Enter only', seq: '\r' },
  { name: 'Newline only', seq: '\n' },
  { name: 'CRLF', seq: '\r\n' },
  { name: 'Double Enter', seq: '\r\r' },
  { name: 'Ctrl+D (EOF)', seq: '\x04' },
  { name: 'Ctrl+J (Line feed)', seq: '\x0a' },
  { name: 'Ctrl+M (Carriage return)', seq: '\x0d' },
  { name: 'Alt+Enter (ESC + Enter)', seq: '\x1b\r' },
  { name: 'Alt+Enter (ESC + [13~)', seq: '\x1b[13~' },
  { name: 'Shift+Enter', seq: '\x1b[27;2;13~' },
  { name: 'Ctrl+Enter', seq: '\x1b[27;5;13~' },
  { name: 'Tab then Enter', seq: '\t\r' },
  { name: 'Ctrl+O (Submit in some apps)', seq: '\x0f' },
  { name: 'Ctrl+X (Cut/Execute)', seq: '\x18' },
];

let currentTest = 0;

function runTest() {
  if (currentTest >= sequences.length) {
    console.log('\nAll tests completed. None worked :(');
    process.exit(1);
  }

  const test = sequences[currentTest];
  console.log(`\nTest ${currentTest + 1}: ${test.name}`);
  console.log(`Sequence: ${test.seq.replace(/\x1b/g, '\\x1b').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}`);

  const pty = spawn('claude', ['--dangerously-skip-permissions'], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: '/tmp/test-project',
    env: process.env
  });

  let ready = false;
  let responded = false;

  pty.onData((data) => {
    if (!ready && data.includes('│ >')) {
      ready = true;
      setTimeout(() => {
        console.log('  Sending: "Hello"' + test.name);
        pty.write('Hello');
        setTimeout(() => {
          console.log('  Sending sequence...');
          pty.write(test.seq);
        }, 100);
      }, 500);
    }
    
    // Check if we got a response
    if (ready && !responded && (
      data.toLowerCase().includes('hello') && data.toLowerCase().includes('help') ||
      data.toLowerCase().includes('assist') ||
      data.toLowerCase().includes('claude')
    )) {
      responded = true;
      console.log(`  ✅ SUCCESS! "${test.name}" worked!`);
      console.log('  Response detected:', data.substring(0, 100).replace(/\n/g, '\\n'));
      pty.kill();
      process.exit(0);
    }
  });

  // Timeout and try next
  setTimeout(() => {
    console.log('  ❌ No response, trying next...');
    pty.kill();
    currentTest++;
    setTimeout(runTest, 100);
  }, 3000);
}

runTest();