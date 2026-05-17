<script>
  import { formatPathDisplay, getWorkspaceHome, resolveWorkspace } from '$lib/workspace';

  let { groups, activeSessionId, activeWorkspace, onSelect, onWorkspaceSelect, showStatus = true } = $props();

  // Collapse state: Set of collapsed workspace paths
  let collapsed = $state(new Set());

  // Sort workspace keys: home dir first, then alphabetical
  const sortedWorkspaces = Object.keys(groups).sort((a, b) => {
    const home = getWorkspaceHome();
    if (a === home) return -1;
    if (b === home) return 1;
    return a.localeCompare(b);
  });

  function toggleCollapse(workspace, e) {
    e.stopPropagation();
    const next = new Set(collapsed);
    if (next.has(workspace)) {
      next.delete(workspace);
    } else {
      next.add(workspace);
    }
    collapsed = next;
  }

  function isCollapsed(workspace) {
    return collapsed.has(workspace);
  }
</script>

<div class="space-y-1">
  {#each sortedWorkspaces as workspace}
    {@const sessions = groups[workspace]}
    {@const isActive = resolveWorkspace(activeWorkspace) === resolveWorkspace(workspace)}
    {@const expanded = !isCollapsed(workspace)}
    {#if sessions.length > 0}
      <div class="rounded-2xl {isActive ? 'bg-blue-50/60' : ''}">
        <!-- Workspace Header -->
        <div
          onclick={() => onWorkspaceSelect(workspace)}
          role="button"
          tabindex="0"
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWorkspaceSelect(workspace); } }}
          class="w-full flex items-center justify-between px-3 py-2 text-left rounded-2xl hover:bg-zinc-100 cursor-pointer {isActive ? 'hover:bg-blue-100/60' : ''}"
        >
          <div class="flex items-center gap-2 min-w-0">
            <!-- Chevron toggle -->
            <button
              onclick={(e) => toggleCollapse(workspace, e)}
              class="p-1 rounded-lg hover:bg-zinc-200/60 flex-shrink-0"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <i class="fa-solid fa-chevron-down text-xs text-zinc-400 transition-transform duration-200 {expanded ? '' : '-rotate-90'}"></i>
            </button>
            <div class="text-xs font-semibold uppercase tracking-wide truncate {isActive ? 'text-blue-700' : 'text-zinc-500'}">
              {formatPathDisplay(workspace)}
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            {#if isActive}
              <div class="w-2 h-2 rounded-full bg-blue-500"></div>
            {/if}
            <div class="text-xs text-zinc-400">{sessions.length}</div>
          </div>
        </div>

        <!-- Sessions -->
        {#if expanded}
          <div class="space-y-1 px-2 pb-1">
            {#each sessions as session}
              <button
                onclick={() => onSelect(session.id)}
                class="w-full px-3 py-2.5 text-left rounded-xl hover:bg-zinc-100 flex justify-between items-center text-sm {activeSessionId === session.id
                  ? 'bg-zinc-100 border border-zinc-300'
                  : ''}"
              >
                <div class="min-w-0">
                  <div class="font-medium truncate text-sm">{session.name}</div>
                  <div class="text-xs text-zinc-500">{session.model}</div>
                </div>

                {#if showStatus && session.status === 'thinking'}
                  <div class="flex items-center h-full flex-shrink-0 ml-2">
                    <div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/each}
</div>
