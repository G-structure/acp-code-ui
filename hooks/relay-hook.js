#!/usr/bin/env node

const http = require('http');
const fs = require('fs');

async function main() {
  let input = '';
  
  process.stdin.setEncoding('utf8');
  
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  
  try {
    const data = JSON.parse(input);
    
    const endpoint = process.env.CLAUDE_CODE_HOOK_ENDPOINT || 'http://localhost:3001/api/hooks';
    const eventType = process.env.CLAUDE_CODE_HOOK_EVENT || 'UnknownEvent';
    
    const postData = JSON.stringify(data);
    
    const url = new URL(`${endpoint}/${eventType}`);
    const options = {
      hostname: url.hostname,
      port: url.port || 3001,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        console.error(`Failed to relay hook event: ${res.statusCode}`);
      }
    });
    
    req.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
    });
    
    req.write(postData);
    req.end();
    
    console.log(JSON.stringify(data));
    
    process.exit(0);
  } catch (error) {
    console.error('Error processing hook:', error);
    process.exit(1);
  }
}

main().catch(console.error);