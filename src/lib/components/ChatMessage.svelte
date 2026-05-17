<script>
  let { msg } = $props();
</script>

<div class="flex w-full {msg.role === 'user' ? 'justify-end' : ''}">
  <div
    class="max-w-[80%] px-4 py-3 rounded-3xl text-sm break-words whitespace-pre-wrap {msg.role === 'user'
      ? 'bg-blue-600 text-white'
      : 'bg-white border border-zinc-200'}"
  >
    {#if msg.role === 'tool'}
      <div class="tool-glow text-xs font-mono mb-1 flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
        tool call
      </div>
    {/if}
    {msg.content}
  </div>
</div>

<style>
  .tool-glow {
    color: #b45309;
    text-shadow: 0 0 8px rgba(245, 158, 11, 0.4), 0 0 16px rgba(245, 158, 11, 0.2);
  }
</style>
