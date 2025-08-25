import { spawn } from 'node-pty';

console.log('Testing PTY with echo command...');

const pty = spawn('echo', ['Hello from PTY'], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: process.env
});

pty.onData((data) => {
  console.log('Output:', data);
});

pty.onExit(({ exitCode, signal }) => {
  console.log(`Process exited with code ${exitCode}, signal ${signal}`);
});

setTimeout(() => {
  console.log('\nNow testing with Claude...');
  
  const claude = spawn('claude', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: '/tmp/test-project',
    env: process.env
  });

  claude.onData((data) => {
    console.log('Claude output:', data);
  });

  claude.onExit(({ exitCode, signal }) => {
    console.log(`Claude exited with code ${exitCode}, signal ${signal}`);
    process.exit(0);
  });

  // Send a test prompt after a delay
  setTimeout(() => {
    console.log('Sending test prompt...');
    claude.write('Hello Claude\r\n');
  }, 2000);

  // Exit after 10 seconds
  setTimeout(() => {
    console.log('Timeout reached, killing Claude...');
    claude.kill();
  }, 10000);
}, 1000);