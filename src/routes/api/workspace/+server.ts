import { json } from '@sveltejs/kit';
import { access, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

const HOME = process.env.HOME || '/';

function resolvePath(raw: string): string {
  const trimmed = raw.trim() || HOME;
  if (trimmed === '~') return HOME;
  if (trimmed.startsWith('~/')) return join(HOME, trimmed.slice(2));
  return trimmed.replace(/\/+$/, '') || '/';
}

export async function GET({ url }) {
  const path = resolvePath(url.searchParams.get('path') || HOME);
  const list = url.searchParams.get('list') === '1';

  let exists = false;
  let isDirectory = false;
  let children: string[] = [];

  try {
    await access(path, constants.F_OK);
    exists = true;
    const info = await stat(path);
    isDirectory = info.isDirectory();

    if (list && isDirectory) {
      const entries = await readdir(path, { withFileTypes: true });
      children = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 40);
    }
  } catch {
    // leave exists false
  }

  return json({ home: HOME, path, exists, isDirectory, children });
}
