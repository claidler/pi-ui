<script>
  import ChatMessage from './ChatMessage.svelte';

  let { 
    messages, 
    showScrollButton, 
    scrollToBottom, 
    handleScroll, 
    messagesContainer = $bindable(),
    currentStreamingMessage = '',
    isProcessing = false
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

  {#if isProcessing && !currentStreamingMessage}
    <div class="flex w-full">
      <div class="thinking-bubble max-w-[80%] px-4 py-3 rounded-3xl text-sm bg-white border border-zinc-200">
        <span class="thinking-pulse">thinking</span><span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
      </div>
    </div>
  {/if}

  <style>
    .thinking-bubble {
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.08), 0 0 40px rgba(139, 92, 246, 0.04);
      animation: bubble-glow 3s ease-in-out infinite;
    }
    @keyframes bubble-glow {
      0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.08), 0 0 40px rgba(139, 92, 246, 0.04); }
      50% { box-shadow: 0 0 28px rgba(59, 130, 246, 0.14), 0 0 56px rgba(139, 92, 246, 0.08); }
    }
    .thinking-pulse {
      background: linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6);
      background-size: 200% auto;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shine 2s linear infinite;
      font-weight: 500;
    }
    @keyframes shine {
      0% { background-position: 0% center; }
      100% { background-position: 200% center; }
    }
    .thinking-dots span {
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      opacity: 0;
      animation: dot-fade 1.4s infinite;
    }
    .thinking-dots span:nth-child(1) { animation-delay: 0s; }
    .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
    .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dot-fade {
      0%, 100% { opacity: 0; }
      50% { opacity: 1; }
    }
  </style>

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
