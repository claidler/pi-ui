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

function parseModelsOutput(output) {
  const lines = output.trim().split('\n');
  const models = [];
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Split by whitespace and filter empty strings
    const parts = line.split(/\s+/).filter(p => p);
    if (parts.length >= 2) {
      const provider = parts[0];
      const model = parts[1];
      // Always show provider clearly
      const display = `${provider} — ${model}`;
      models.push({
        id: `${provider}/${model}`,
        provider,
        model,
        display
      });
    }
  }
  return models;
}

const wss = new WebSocketServer({ port: PORT });
console.log(`[bridge] WebSocket server listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  console.log('[bridge] Client connected');
  let pi = null;
  let buffer = '';
  let currentSessionId = null;
  let currentModel = null;
  let currentCwd = null;

  function decodeWorkspaceDir(dirName) {
    const inner = dirName.replace(/^--/, '').replace(/--$/, '');
    const home = process.env.HOME || '/';
    const prefix = home.slice(1).replace(/\//g, '-');

    if (inner === prefix) return home;
    if (inner.startsWith(prefix + '-')) {
      const rest = inner.slice(prefix.length + 1);
      const segments = rest.split('-');
      if (segments.length === 1) return home + '/' + segments[0];
      const [first, ...others] = segments;
      return home + '/' + first + '/' + others.join('-');
    }
    return '/' + inner;
  }

  function resolveCwd(sessionId, cwd) {
    if (cwd && typeof cwd === 'string' && cwd.trim()) {
      const trimmed = cwd.trim();
      const home = process.env.HOME || '/';
      if (trimmed === '~') return home;
      if (trimmed.startsWith('~/')) return home + trimmed.slice(1);
      return trimmed.replace(/\/+$/, '') || '/';
    }

    if (sessionId && typeof sessionId === 'string' && sessionId.endsWith('.jsonl')) {
      const parts = sessionId.split('/');
      if (parts.length >= 2) {
        return decodeWorkspaceDir(parts[0]);
      }
    }

    return process.env.HOME || '/';
  }

  function ensurePi(sessionId, model, cwd) {
    const resolvedCwd = resolveCwd(sessionId, cwd);
    const sessionChanged = sessionId !== currentSessionId;
    const modelChanged = model !== currentModel;
    const cwdChanged = resolvedCwd !== currentCwd;

    if (pi && !pi.killed && !sessionChanged && !modelChanged && !cwdChanged) return pi;

    // Kill old process if session, model, or cwd changed
    if (pi && !pi.killed) {
      pi.kill();
      pi = null;
    }

    currentSessionId = sessionId;
    currentModel = model;
    currentCwd = resolvedCwd;

    const args = ['--mode', 'rpc'];
    if (model) args.push('--model', model);

    if (sessionId && typeof sessionId === 'string' && sessionId.endsWith('.jsonl')) {
      const sessionPath = join(SESSIONS_DIR, sessionId);
      args.push('--session', sessionPath);
    }

    console.log(`[bridge] Spawning pi in ${resolvedCwd} with args:`, args);

    pi = spawn('pi', args, {
      cwd: resolvedCwd,
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

    if (msg.type === 'list-models') {
      console.log('[bridge] Fetching model list from pi');
      const proc = spawn('pi', ['--list-models'], {
        env: { ...process.env, PI_NO_TTY: '1' },
      });
      let output = '';
      // pi --list-models outputs to stderr, not stdout
      proc.stderr.on('data', (chunk) => {
        output += chunk.toString();
      });
      proc.on('close', () => {
        const models = parseModelsOutput(output);
        console.log(`[bridge] Parsed ${models.length} models`);
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'models-list', models }));
        }
      });
    } else if (msg.type === 'prompt' && msg.text) {
      const proc = ensurePi(msg.sessionId, msg.model, msg.cwd);
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
