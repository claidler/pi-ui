<script lang="ts">
  import { tick } from 'svelte';
  import {
    formatPathDisplay,
    getWorkspaceHome,
    joinPath,
    loadRecentWorkspaces,
    parentPath,
    rememberWorkspace,
    resolveWorkspace,
    toEditablePath
  } from '$lib/workspace';

  type PathStatus = 'idle' | 'checking' | 'ok' | 'missing';

  let {
    value = $bindable(''),
    suggestions = [],
    sessionWorkspace = undefined,
    onChange
  }: {
    value: string;
    suggestions?: string[];
    sessionWorkspace?: string;
    onChange?: (path: string) => void;
  } = $props();

  let root: HTMLDivElement | undefined = $state();
  let inputEl: HTMLInputElement | undefined = $state();
  /** Absolute path whose children are listed in the menu */
  let browseAt = $state(resolveWorkspace(value));
  let draft = $state(toEditablePath(value));
  let open = $state(false);
  let focused = $state(false);
  let dirty = $state(false);
  let highlightIndex = $state(0);
  let pathStatus = $state<PathStatus>('idle');
  let childDirs = $state<string[]>([]);
  let copied = $state(false);

  const fullPath = $derived(resolveWorkspace(value));
  const displayValue = $derived(formatPathDisplay(value));
  const sessionMismatch = $derived(
    sessionWorkspace != null &&
      resolveWorkspace(sessionWorkspace) !== resolveWorkspace(value)
  );

  type MenuItem =
    | { kind: 'up' }
    | { kind: 'dir'; name: string }
    | { kind: 'quick'; path: string; label: string }
    | { kind: 'select' };

  const quickPaths = $derived.by(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (p: string) => {
      const r = resolveWorkspace(p);
      if (seen.has(r)) return;
      seen.add(r);
      out.push(r);
    };
    for (const p of loadRecentWorkspaces()) add(p);
    for (const p of suggestions) add(p);
    return out;
  });

  const filterSegment = $derived.by(() => {
    const d = draft;
    if (d === '~' || d === '~/') return '';
    const lastSlash = d.lastIndexOf('/');
    return lastSlash >= 0 ? d.slice(lastSlash + 1).toLowerCase() : d.toLowerCase();
  });

  const menuItems = $derived.by((): MenuItem[] => {
    const items: MenuItem[] = [];
    const parent = parentPath(browseAt);
    if (parent != null) items.push({ kind: 'up' });

    const dirs = childDirs.filter((name) =>
      !filterSegment ? true : name.toLowerCase().includes(filterSegment)
    );
    for (const name of dirs) items.push({ kind: 'dir', name });

    const browseResolved = resolveWorkspace(browseAt);
    for (const p of quickPaths) {
      if (p === browseResolved) continue;
      const label = toEditablePath(p);
      if (filterSegment && !label.toLowerCase().includes(filterSegment)) continue;
      items.push({ kind: 'quick', path: p, label });
    }

    items.push({ kind: 'select' });
    return items;
  });

  $effect(() => {
    if (!focused && !open) {
      browseAt = resolveWorkspace(value);
      draft = toEditablePath(value);
    }
  });

  $effect(() => {
    if (!open) {
      childDirs = [];
      return;
    }
    const path = resolveWorkspace(browseAt);
    fetch(`/api/workspace?path=${encodeURIComponent(path)}&list=1`)
      .then((r) => r.json())
      .then((data) => {
        if (data.isDirectory && Array.isArray(data.children)) {
          childDirs = data.children;
        } else {
          childDirs = [];
        }
      })
      .catch(() => {
        childDirs = [];
      });
  });

  function syncBrowseFromDraft() {
    const text = draft.trim() || '~';
    if (text.endsWith('/')) {
      browseAt = resolveWorkspace(text);
    } else {
      browseAt = resolveWorkspace(text);
    }
  }

  async function validatePath(path: string): Promise<boolean> {
    pathStatus = 'checking';
    try {
      const res = await fetch(`/api/workspace?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      const ok = Boolean(data.exists && data.isDirectory);
      pathStatus = ok ? 'ok' : 'missing';
      return ok;
    } catch {
      pathStatus = 'missing';
      return false;
    }
  }

  async function apply(path: string, notify = true) {
    const resolved = resolveWorkspace(path);
    const ok = await validatePath(resolved);
    if (!ok) return;

    value = resolved;
    browseAt = resolved;
    draft = toEditablePath(resolved);
    open = false;
    focused = false;
    highlightIndex = 0;
    rememberWorkspace(resolved);
    dirty = false;
    pathStatus = 'ok';
    if (notify) onChange?.(resolved);
  }

  function openMenu() {
    open = true;
    highlightIndex = 0;
  }

  function closeMenu() {
    open = false;
    focused = false;
    browseAt = resolveWorkspace(value);
    draft = toEditablePath(value);
    pathStatus = 'idle';
  }

  function navigateUp() {
    const parent = parentPath(browseAt);
    if (parent == null) return;
    browseAt = parent;
    draft = toEditablePath(parent) + '/';
    dirty = false;
    highlightIndex = 0;
  }

  function navigateInto(name: string) {
    browseAt = joinPath(browseAt, name);
    draft = toEditablePath(browseAt) + '/';
    dirty = false;
    highlightIndex = 0;
  }

  function activateItem(item: MenuItem) {
    if (item.kind === 'up') navigateUp();
    else if (item.kind === 'dir') navigateInto(item.name);
    else if (item.kind === 'quick') {
      browseAt = resolveWorkspace(item.path);
      draft = toEditablePath(item.path) + '/';
      dirty = false;
      highlightIndex = 0;
    } else if (item.kind === 'select') {
      apply(browseAt);
    }
  }

  function commitDraft() {
    if (open && menuItems.length > 0) {
      activateItem(menuItems[Math.min(highlightIndex, menuItems.length - 1)]);
      if (menuItems[Math.min(highlightIndex, menuItems.length - 1)].kind === 'select') {
        inputEl?.blur();
      }
      return;
    }
    apply(draft);
  }

  async function startEdit() {
    focused = true;
    dirty = false;
    browseAt = resolveWorkspace(value);
    draft = toEditablePath(browseAt) + '/';
    pathStatus = 'idle';
    openMenu();
    await tick();
    inputEl?.focus();
  }

  function onFocus() {
    if (!focused) {
      focused = true;
      browseAt = resolveWorkspace(value);
      if (!draft || !dirty) {
        draft = toEditablePath(browseAt);
        if (browseAt !== getWorkspaceHome() && !draft.endsWith('/')) draft += '/';
      }
    }
    openMenu();
  }

  function onBlur() {
    focused = false;
    setTimeout(() => {
      if (!root?.contains(document.activeElement)) {
        if (dirty) apply(draft.replace(/\/+$/, '') || '~');
        else closeMenu();
      }
    }, 0);
  }

  function onInput() {
    dirty = true;
    open = true;
    highlightIndex = 0;
    pathStatus = 'idle';
    syncBrowseFromDraft();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === '/' && !e.shiftKey && open) {
      syncBrowseFromDraft();
      return;
    }

    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      startEdit();
      e.preventDefault();
      return;
    }
    if (!open) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitDraft();
      } else if (e.key === 'Escape') {
        closeMenu();
        inputEl?.blur();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightIndex = Math.min(highlightIndex + 1, menuItems.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightIndex = Math.max(highlightIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = menuItems[highlightIndex];
      activateItem(item);
      if (item.kind === 'select') inputEl?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    }
  }

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(fullPath);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 1500);
    } catch {
      // ignore
    }
  }

  function useSessionWorkspace() {
    if (sessionWorkspace) apply(sessionWorkspace);
  }
</script>

<div class="relative min-w-0 max-w-[10rem] sm:max-w-[13rem]" bind:this={root}>
  <div
    class="flex items-center min-w-0 rounded hover:bg-zinc-50 focus-within:bg-white focus-within:ring-1
      {pathStatus === 'missing'
      ? 'ring-1 ring-red-300 focus-within:ring-red-300'
      : 'focus-within:ring-zinc-200'}"
  >
    {#if sessionMismatch}
      <span
        class="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 ml-1"
        title="Agent cwd differs from this session's saved workspace"
      ></span>
    {/if}

    {#if focused || open}
      <input
        bind:this={inputEl}
        type="text"
        bind:value={draft}
        onfocus={onFocus}
        onblur={onBlur}
        oninput={onInput}
        onkeydown={onKeydown}
        placeholder="~/workspace/project"
        title={fullPath}
        autocomplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="workspace-listbox"
        aria-invalid={pathStatus === 'missing'}
        class="min-w-0 flex-1 px-1.5 py-0.5 text-xs font-mono text-zinc-600 bg-transparent outline-none"
      />
    {:else}
      <button
        type="button"
        onclick={startEdit}
        title={sessionMismatch
          ? `${fullPath}\n(session: ${toEditablePath(sessionWorkspace ?? '')})`
          : fullPath}
        class="min-w-0 flex-1 px-1.5 py-0.5 text-left text-xs font-mono text-zinc-600 truncate"
      >
        {displayValue}
      </button>
    {/if}

    <button
      type="button"
      tabindex="-1"
      aria-label={copied ? 'Copied' : 'Copy path'}
      onclick={copyPath}
      class="px-0.5 py-0.5 text-zinc-400 hover:text-zinc-600 flex-shrink-0"
    >
      <i class="fa-solid {copied ? 'fa-check text-emerald-500' : 'fa-copy'} text-[9px]"></i>
    </button>

    <button
      type="button"
      tabindex="-1"
      aria-label="Browse directories"
      onclick={() => {
        if (open) closeMenu();
        else startEdit();
      }}
      class="px-1 py-0.5 text-zinc-400 hover:text-zinc-600 flex-shrink-0"
    >
      <i class="fa-solid fa-chevron-down text-[9px] {open ? 'rotate-180' : ''} transition-transform"></i>
    </button>
  </div>

  {#if pathStatus === 'missing'}
    <p class="absolute left-0 top-full mt-0.5 text-[10px] text-red-600 whitespace-nowrap">
      Not a directory
    </p>
  {/if}

  {#if open && menuItems.length > 0}
    <ul
      id="workspace-listbox"
      role="listbox"
      class="absolute z-50 left-0 min-w-[14rem] w-max max-w-[22rem] top-full mt-0.5 max-h-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-0.5 shadow-lg
        {pathStatus === 'missing' ? 'mt-3' : ''}"
    >
      {#if sessionMismatch && sessionWorkspace}
        <li>
          <button
            type="button"
            tabindex="-1"
            onmousedown={(e) => e.preventDefault()}
            onclick={() => {
              useSessionWorkspace();
              inputEl?.blur();
            }}
            class="w-full px-2 py-1.5 text-left text-xs text-amber-800 bg-amber-50/80 hover:bg-amber-50 border-b border-amber-100"
          >
            Use session {toEditablePath(sessionWorkspace)}
          </button>
        </li>
      {/if}

      {#each menuItems as item, i}
        <li role="option" aria-selected={i === highlightIndex}>
          <button
            type="button"
            tabindex="-1"
            title={item.kind === 'dir'
              ? joinPath(browseAt, item.name)
              : item.kind === 'quick'
                ? resolveWorkspace(item.path)
                : item.kind === 'select'
                  ? resolveWorkspace(browseAt)
                  : parentPath(browseAt) ?? ''}
            onmousedown={(e) => e.preventDefault()}
            onclick={() => {
              activateItem(item);
              if (item.kind === 'select') inputEl?.blur();
            }}
            class="w-full px-2 py-1.5 text-left text-xs font-mono flex items-center gap-2 min-w-0
              {i === highlightIndex ? 'bg-blue-50 text-blue-800' : 'text-zinc-700 hover:bg-zinc-50'}
              {item.kind === 'select' ? 'border-t border-zinc-100 font-sans font-medium text-blue-700' : ''}
              {item.kind === 'quick' ? 'text-zinc-500' : ''}"
          >
            {#if item.kind === 'up'}
              <i class="fa-solid fa-arrow-up text-[9px] text-zinc-400"></i>
              <span>..</span>
            {:else if item.kind === 'dir'}
              <i class="fa-solid fa-folder text-[9px] text-zinc-400 flex-shrink-0"></i>
              <span class="truncate">{item.name}/</span>
            {:else if item.kind === 'quick'}
              <i class="fa-solid fa-clock-rotate-left text-[9px] text-zinc-400 flex-shrink-0"></i>
              <span class="truncate">{item.label}</span>
            {:else if item.kind === 'select'}
              <i class="fa-solid fa-check text-[9px] flex-shrink-0"></i>
              <span class="truncate">Use {toEditablePath(browseAt)}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
