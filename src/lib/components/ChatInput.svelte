<script>
  let { newMessage = $bindable(''), isProcessing, sendMessage, stopProcessing } = $props();
</script>

<div class="p-4 border-t bg-white flex-shrink-0">
  <div class="flex items-center gap-2 bg-white border border-zinc-300 rounded-3xl px-4 py-2">
    <input
      bind:value={newMessage}
      onkeydown={(e) => {
        if (e.key === 'Enter' && !isProcessing) {
          e.preventDefault();
          sendMessage();
        }
      }}
      type="text"
      placeholder={isProcessing ? "Agent is thinking..." : "Message the agent..."}
      class="flex-1 outline-none text-sm bg-transparent"
      disabled={isProcessing}
    />

    {#if isProcessing}
      <button
        onclick={stopProcessing}
        class="w-9 h-9 bg-red-500 text-white rounded-2xl flex items-center justify-center hover:bg-red-600 transition-colors"
      >
        <i class="fa-solid fa-stop"></i>
      </button>
    {:else}
      <button
        onclick={sendMessage}
        class="w-9 h-9 bg-blue-600 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
      >
        <i class="fa-solid fa-arrow-up"></i>
      </button>
    {/if}
  </div>
</div>
