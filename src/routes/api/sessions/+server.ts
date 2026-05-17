import { json } from '@sveltejs/kit';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { decodeWorkspaceName } from '$lib/workspace';

const SESSIONS_DIR = '/home/claidler/.pi/agent/sessions';

function parseSessionFilename(filename: string) {
  // 2026-05-17T18-35-44-110Z_019e3739-046e-71b4-abb2-9026bd7190af.jsonl
  const base = filename.replace(/\.jsonl$/, '');
  const [timestamp, id] = base.split('_');
  return { timestamp, id, filename };
}

async function getSessionName(filePath: string): Promise<string> {
  try {
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity
    });

    let firstUserMessage = '';
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === 'message' && event.message?.role === 'user') {
          const content = extractTextContent(event.message.content);
          if (content) {
            firstUserMessage = content;
            break;
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    rl.close();
    return firstUserMessage || 'Untitled session';
  } catch {
    return 'Untitled session';
  }
}

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

export async function GET() {
  const groups: Record<string, Array<{
    id: string;
    name: string;
    path: string;
    workspace: string;
    model: string;
    status: string;
    createdAt: string;
  }>> = {};

  try {
    const workspaceDirs = await readdir(SESSIONS_DIR);

    for (const dir of workspaceDirs) {
      const workspacePath = join(SESSIONS_DIR, dir);
      const s = await stat(workspacePath);
      if (!s.isDirectory()) continue;

      const workspace = decodeWorkspaceName(dir);
      const files = await readdir(workspacePath);
      const workspaceSessions = [];

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        const { timestamp, id } = parseSessionFilename(file);
        const filePath = join(workspacePath, file);
        const name = await getSessionName(filePath);

        workspaceSessions.push({
          id: `${dir}/${file}`,
          name: name.length > 60 ? name.slice(0, 60) + '…' : name,
          path: `${dir}/${file}`,
          workspace,
          model: 'pi-agent',
          status: 'idle',
          createdAt: timestamp || ''
        });
      }

      // Sort sessions within each workspace by createdAt descending
      workspaceSessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      groups[workspace] = workspaceSessions;
    }
  } catch (err) {
    console.error('Failed to read sessions:', err);
  }

  return json({ groups });
}
