import { json, error } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { join } from 'path';

const SESSIONS_DIR = '/home/claidler/.pi/agent/sessions';

function extractTextContent(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');
  }
  return '';
}

function extractThinking(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return '';
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c.type === 'thinking')
      .map((c: any) => c.thinking)
      .join('');
  }
  return '';
}

function extractToolCalls(content: any): Array<{ id: string; name: string; arguments: any }> {
  if (!content) return [];
  if (typeof content === 'string') return [];
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c.type === 'toolCall')
      .map((c: any) => ({ id: c.id, name: c.name, arguments: c.arguments }));
  }
  return [];
}

export async function GET({ params }) {
  const path = params.path;
  if (!path || path.includes('..')) {
    throw error(400, 'Invalid path');
  }

  const filePath = join(SESSIONS_DIR, path);

  try {
    const data = await readFile(filePath, 'utf-8');
    const lines = data.split('\n').filter((l: string) => l.trim());

    const messages: Array<{
      role: string;
      content: string;
      toolCallId?: string;
      toolName?: string;
      toolCalls?: Array<{ id: string; name: string; arguments: any }>;
    }> = [];

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.type !== 'message' || !event.message) continue;

        const msg = event.message;
        const role = msg.role;

        if (role === 'user') {
          const text = extractTextContent(msg.content);
          if (text) {
            messages.push({ role: 'user', content: text });
          }
        } else if (role === 'assistant') {
          const text = extractTextContent(msg.content);
          const thinking = extractThinking(msg.content);
          const toolCalls = extractToolCalls(msg.content);

          if (thinking) {
            messages.push({ role: 'agent', content: `🤔 Thinking…\n\n${thinking}` });
          }
          if (text) {
            messages.push({ role: 'agent', content: text });
          }
          if (toolCalls.length > 0) {
            for (const tc of toolCalls) {
              messages.push({
                role: 'tool',
                content: `${tc.name}(${JSON.stringify(tc.arguments, null, 2)})`,
                toolCallId: tc.id,
                toolCalls: [tc]
              });
            }
          }
        } else if (role === 'toolResult') {
          const text = extractTextContent(msg.content);
          if (text) {
            messages.push({
              role: 'tool',
              content: `[${msg.toolName}] Result:\n${text}`,
              toolCallId: msg.toolCallId,
              toolName: msg.toolName
            });
          }
        }
      } catch {
        // skip malformed lines
      }
    }

    return json({ messages });
  } catch (err: any) {
    console.error('Failed to read session:', err);
    throw error(500, 'Failed to read session');
  }
}
