<script>
  import ChatMessage from './ChatMessage.svelte';

  let { 
    messages, 
    showScrollButton, 
    scrollToBottom, 
    handleScroll, 
    messagesContainer = $bindable(),
    currentStreamingMessage = ''
  } = $props();
</script>

<!-- Messages Container -->
<div
  bind:this={messagesContainer}
  onscroll={handleScroll}
  class="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-zinc-50 min-h-0 relative"
>
  {#each messages as msg}
    <ChatMessage {msg} />
  {/each}

  {#if currentStreamingMessage}
    <ChatMessage msg={{ role: 'agent', content: currentStreamingMessage }} />
  {/if}

  <!-- Scroll to Bottom Button -->
  {#if showScrollButton}
    <button
      onclick={scrollToBottom}
      class="fixed bottom-24 right-6 md:right-8 w-10 h-10 bg-white border border-zinc-300 shadow-lg rounded-full flex items-center justify-center text-blue-600 hover:bg-zinc-50 transition-all active:scale-95 z-40"
    >
      <i class="fa-solid fa-arrow-down"></i>
    </button>
  {/if}
</div>
