/** Fallback until /api/workspace returns the real home. */
export const DEFAULT_HOME = '/home/claidler';

let homeDir = DEFAULT_HOME;

export function getWorkspaceHome(): string {
  return homeDir;
}

export function setWorkspaceHome(path: string): void {
  homeDir = path.replace(/\/+$/, '') || path || DEFAULT_HOME;
}

function home(): string {
  return homeDir;
}

/** Expand ~ and normalize to an absolute workspace path. */
export function resolveWorkspace(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return home();
  if (trimmed === '~') return home();
  if (trimmed.startsWith('~/')) {
    return (home() + trimmed.slice(1)).replace(/\/+$/, '') || home();
  }
  return trimmed.replace(/\/+$/, '') || '/';
}

/** Path for display and editing: ~/workspace/pi-ui */
export function toEditablePath(path: string): string {
  const resolved = resolveWorkspace(path);
  const h = home();
  if (resolved === h) return '~';
  if (resolved.startsWith(h + '/')) return '~/' + resolved.slice(h.length + 1);
  return resolved;
}

/** Short label for sidebar (alias of editable path, may truncate elsewhere). */
export function formatWorkspace(path: string): string {
  return toEditablePath(path);
}

export function parentPath(path: string): string | null {
  const resolved = resolveWorkspace(path);
  const h = home();
  if (resolved === h) return null;
  const parent = resolved.replace(/\/[^/]+$/, '');
  if (!parent || parent === resolved) return h === resolved ? null : h;
  return parent;
}

export function joinPath(base: string, name: string): string {
  return resolveWorkspace(base).replace(/\/+$/, '') + '/' + name.replace(/^\/+/, '');
}

/** Collapsed UI: ~/…/pi-ui */
export function formatPathDisplay(path: string, maxLen = 26): string {
  let label = toEditablePath(path);
  if (label.length <= maxLen) return label;
  const parts = label.replace(/^~\/?/, '').split('/').filter(Boolean);
  if (parts.length > 0) {
    const last = parts[parts.length - 1]!;
    if (last.length <= maxLen) return '~/' + last;
    const tail = parts.slice(-2).join('/');
    if (('~/' + tail).length <= maxLen) return '~/' + tail;
  }
  return label.slice(0, Math.max(1, maxLen - 1)) + '…';
}

/** @deprecated Use formatPathDisplay */
export function formatWorkspaceDisplay(path: string, maxLen = 22): string {
  return formatPathDisplay(path, maxLen);
}

function homeEncoded(): string {
  return home().slice(1).replace(/\//g, '-');
}

/** Encode workspace path to pi session directory name (--home-user-workspace-repo--). */
export function encodeWorkspaceName(workspacePath: string): string {
  const resolved = resolveWorkspace(workspacePath);
  const h = home();
  if (resolved === h) return '--' + homeEncoded() + '--';
  if (resolved.startsWith(h + '/')) {
    const rel = resolved.slice(h.length + 1);
    return '--' + homeEncoded() + '-' + rel.replace(/\//g, '-') + '--';
  }
  return '--' + resolved.slice(1).replace(/\//g, '-') + '--';
}

/**
 * Decode pi session directory name to workspace path.
 * Pi joins path segments with `-`; hyphens inside a segment (e.g. pi-ui) are preserved
 * by rejoining all segments after the first under $HOME.
 */
export function decodeWorkspaceName(dirName: string): string {
  const inner = dirName.replace(/^--/, '').replace(/--$/, '');
  const h = home();
  const prefix = homeEncoded();

  if (inner === prefix) return h;
  if (inner.startsWith(prefix + '-')) {
    const rest = inner.slice(prefix.length + 1);
    const segments = rest.split('-');
    if (segments.length === 1) return h + '/' + segments[0];
    const [first, ...others] = segments;
    return h + '/' + first + '/' + others.join('-');
  }

  return '/' + inner;
}

/** Fix paths saved when decode turned `-` into wrong slash placement. */
export function repairLegacyWorkspacePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.includes('//')) return resolveWorkspace(path);
  if (/^\/[^/]+$/.test(trimmed) && trimmed.includes('-')) {
    return decodeWorkspaceName('--' + trimmed.slice(1) + '--');
  }
  return resolveWorkspace(path);
}

const RECENT_KEY = 'pi-ui:recent-workspaces';
const MAX_RECENT = 12;

export function loadRecentWorkspaces(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => repairLegacyWorkspacePath(String(p)));
  } catch {
    return [];
  }
}

export function rememberWorkspace(path: string): void {
  if (typeof window === 'undefined') return;
  const resolved = resolveWorkspace(path);
  const prev = loadRecentWorkspaces().filter((p) => p !== resolved);
  localStorage.setItem(RECENT_KEY, JSON.stringify([resolved, ...prev].slice(0, MAX_RECENT)));
}

/** Match query against display label and full path. */
export function workspaceMatchesQuery(workspacePath: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const resolved = resolveWorkspace(workspacePath);
  const display = toEditablePath(workspacePath).toLowerCase();
  return (
    display.includes(q) ||
    resolved.toLowerCase().includes(q) ||
    workspacePath.toLowerCase().includes(q)
  );
}
