<script>
  let { sessions, activeSessionId, onSelect, showStatus = true } = $props();
</script>

<div class="space-y-1">
  {#each sessions as session}
    <button
      onclick={() => onSelect(session.id)}
      class="w-full px-4 py-3 text-left rounded-2xl mb-1 hover:bg-zinc-100 flex justify-between items-center text-sm {activeSessionId === session.id
        ? 'bg-zinc-100 border border-zinc-300'
        : ''}"
    >
      <div>
        <div class="font-medium">{session.name}</div>
        <div class="text-xs text-zinc-500">{session.model}</div>
      </div>

      {#if showStatus && session.status === 'thinking'}
        <div class="flex items-center h-full">
          <div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      {/if}
    </button>
  {/each}
</div>
