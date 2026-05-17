import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:8643');

ws.on('open', () => {
  console.log('✓ Connected!');
  ws.send(JSON.stringify({ type: 'list-models' }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('✓ Received:', msg.type);
  if (msg.type === 'models-list') {
    console.log(`✓ Got ${msg.models.length} models`);
    console.log('  First 3 models:', msg.models.slice(0, 3).map(m => m.display));
  }
  ws.close();
});

ws.on('error', (err) => {
  console.error('✗ Error:', err);
  console.error('  Message:', err.message);
  console.error('  Code:', err.code);
});

ws.on('close', (code, reason) => {
  console.log(`✓ Connection closed (code: ${code}, reason: ${reason || 'none'})`);
  process.exit(code === 1000 ? 0 : 1);
});

setTimeout(() => {
  console.log('✗ Timeout - no response');
  ws.close();
  process.exit(1);
}, 5000);
