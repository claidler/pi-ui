/**
 * Pi WebSocket Bridge — proper RPC mode
 *
 * Spawns `pi --mode rpc` once per WebSocket connection, keeps it alive,
 * and forwards JSON commands via stdin / events via stdout.
 */
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { join } from 'path';

const PORT = 8643;
const SESSIONS_DIR = '/home/claidler/.pi/agent/sessions';

const wss = new WebSocketServer({ port: PORT });
console.log(`[bridge] WebSocket server listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  console.log('[bridge] Client connected');
  let pi = null;
  let buffer = '';
  let currentSessionId = null;
  let currentModel = null;

  function ensurePi(sessionId, model) {
    const sessionChanged = sessionId !== currentSessionId;
    const modelChanged = model !== currentModel;

    if (pi && !pi.killed && !sessionChanged && !modelChanged) return pi;

    // Kill old process if session or model changed
    if (pi && !pi.killed) {
      pi.kill();
      pi = null;
    }

    currentSessionId = sessionId;
    currentModel = model;

    const args = ['--mode', 'rpc'];
    if (model) args.push('--model', model);

    let cwd = process.env.HOME;

    if (sessionId && typeof sessionId === 'string' && sessionId.endsWith('.jsonl')) {
      const sessionPath = join(SESSIONS_DIR, sessionId);
      args.push('--session', sessionPath);
      const parts = sessionId.split('/');
      if (parts.length >= 2) {
        const dirName = parts[0];
        cwd = '/' + dirName.replace(/^--/, '').replace(/--$/, '').replace(/--/g, '/');
      }
    }

    console.log(`[bridge] Spawning pi in ${cwd} with args:`, args);

    pi = spawn('pi', args, {
      cwd,
      env: { ...process.env, PI_NO_TTY: '1' },
    });

    pi.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'extension_ui_request') continue;
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'stream', data: event }));
          }
        } catch {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: 'stream',
              data: {
                type: 'message_update',
                assistantMessageEvent: {
                  type: 'text_delta',
                  delta: line + '\n'
                }
              }
            }));
          }
        }
      }
    });

    pi.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (!text.includes('[Mirror]') && !text.includes('Tau mirror')) {
        process.stderr.write(`[pi stderr] ${text}`);
      }
    });

    pi.on('close', (code) => {
      if (buffer.trim() && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'stream',
          data: {
            type: 'message_update',
            assistantMessageEvent: {
              type: 'text_delta',
              delta: buffer
            }
          }
        }));
      }
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'stream', data: { type: 'agent_end' } }));
      }
      console.log(`[bridge] pi exited with code ${code}`);
      pi = null;
      buffer = '';
    });

    pi.on('error', (err) => {
      console.error('[bridge] Failed to spawn pi:', err.message);
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'stream',
          data: {
            type: 'message_update',
            assistantMessageEvent: {
              type: 'text_delta',
              delta: `\nError: ${err.message}\n`
            }
          }
        }));
        ws.send(JSON.stringify({ type: 'stream', data: { type: 'agent_end' } }));
      }
      pi = null;
    });

    return pi;
  }

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      console.warn('[bridge] Invalid JSON received');
      return;
    }

    if (msg.type === 'prompt' && msg.text) {
      const proc = ensurePi(msg.sessionId, msg.model);
      const cmd = JSON.stringify({ type: 'prompt', message: msg.text }) + '\n';
      console.log(`[bridge] Sending prompt: ${msg.text.slice(0, 80)}…`);
      proc.stdin.write(cmd);
    } else if (msg.type === 'stop') {
      if (pi && !pi.killed) {
        pi.stdin.write(JSON.stringify({ type: 'abort' }) + '\n');
      }
    }
  });

  ws.on('close', () => {
    console.log('[bridge] Client disconnected');
    if (pi && !pi.killed) {
      pi.kill();
    }
  });

  ws.on('error', (err) => {
    console.error('[bridge] WS error:', err.message);
  });
});
