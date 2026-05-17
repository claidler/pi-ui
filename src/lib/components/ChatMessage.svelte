<script>
  /** @type {{ role: string, content: string }} */
  let { msg } = $props();
</script>

<div class="flex {msg.role === 'user' ? 'justify-end' : ''}">
  <div
    class="max-w-[80%] px-4 py-3 rounded-3xl text-sm {msg.role === 'user'
      ? 'bg-blue-600 text-white'
      : 'bg-white border border-zinc-200'}"
  >
    {#if msg.role === 'tool'}
      <div class="text-amber-600 text-xs font-mono mb-1">TOOL CALL</div>
    {/if}
    {msg.content}
  </div>
</div>
