<script>
  import ChatMessage from '$lib/components/ChatMessage.svelte';
  import ChatInput from '$lib/components/ChatInput.svelte';
  import MessageList from '$lib/components/MessageList.svelte';
  import SessionList from '$lib/components/SessionList.svelte';
  import ModelSelector from '$lib/components/ModelSelector.svelte';
  import { piWs } from '$lib/services/pi-ws';

  let sessions = $state([
    { id: 1, name: "Refactor auth module", model: "github-copilot/claude-sonnet-4.5", status: "thinking" },
    { id: 2, name: "Build landing page", model: "github-copilot/claude-sonnet-4.5", status: "idle" },
    { id: 3, name: "Debug Pi agent connection", model: "github-copilot/claude-sonnet-4.5", status: "connected" }
  ]);

  let activeSessionId = $state(1);
  let activeSession = $derived(sessions.find(s => s.id === activeSessionId));
  
  let messages = $state([
    { role: "agent", content: "Hi! I'm connected to the pi coding agent. What would you like to work on?" }
  ]);

  let newMessage = $state("");
  let currentModel = $state("github-copilot/claude-sonnet-4.5");
  let showSessionsModal = $state(false);
  let isProcessing = $state(false);
  let showScrollButton = $state(false);
  let messagesContainer;
  let currentStreamingMessage = $state("");

  function selectSession(id) {
    activeSessionId = id;
    showSessionsModal = false;
    setTimeout(scrollToBottom, 100);
  }

  async function sendMessage() {
    if (!newMessage.trim()) return;

    const userMessage = newMessage.trim();
    messages = [...messages, { role: "user", content: userMessage }];
    newMessage = "";
    isProcessing = true;
    currentStreamingMessage = "";

    piWs.sendPrompt(userMessage, { 
      model: currentModel,
      sessionId: activeSessionId 
    });
  }

  function stopProcessing() {
    piWs.stop();
    isProcessing = false;
    if (currentStreamingMessage) {
      messages = [...messages, { role: "agent", content: currentStreamingMessage }];
      currentStreamingMessage = "";
    }
  }

  function createNewSession() {
    const newId = Math.max(...sessions.map(s => s.id)) + 1;
    sessions.push({ id: newId, name: "New session", model: currentModel, status: "idle" });
    sessions = sessions;
    selectSession(newId);
  }

  function stopSession() {
    if (activeSession) {
      activeSession.status = "idle";
    }
    isProcessing = false;
    sessions = [...sessions];
  }

  function toggleSessionsModal() {
    showSessionsModal = !showSessionsModal;
  }

  function scrollToBottom(smooth = true) {
    if (messagesContainer) {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
      showScrollButton = false;
    }
  }

  function handleScroll() {
    if (!messagesContainer) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    showScrollButton = !isNearBottom;
  }

  $effect(() => {
    if (messages.length > 0 && messagesContainer) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      
      if (isNearBottom) {
        setTimeout(() => scrollToBottom(false), 10);
      } else {
        showScrollButton = true;
      }
    }
  });

  // WebSocket streaming handlers
  $effect(() => {
    const handleStream = (chunk) => {
      try {
        if (chunk?.type === 'text' && chunk.content) {
          currentStreamingMessage += chunk.content;
        } else if (chunk?.type === 'status') {
          console.log('[pi-ws] Status:', chunk.content);
        }
      } catch (e) {
        console.error('[pi-ws] Stream handler error:', e);
      }
    };

    const handleDone = () => {
      try {
        if (currentStreamingMessage.trim()) {
          messages = [...messages, { role: "agent", content: currentStreamingMessage.trim() }];
          currentStreamingMessage = "";
        }
        isProcessing = false;
        scrollToBottom();
      } catch (e) {
        console.error('[pi-ws] Done handler error:', e);
        isProcessing = false;
      }
    };

    const handleError = (err) => {
      try {
        console.error("[pi-ws] Error:", err);
        if (currentStreamingMessage) {
          messages = [...messages, { role: "agent", content: currentStreamingMessage }];
          currentStreamingMessage = "";
        }
        messages = [...messages, { 
          role: "agent", 
          content: "Error from pi coding agent." 
        }];
        isProcessing = false;
      } catch (e) {
        console.error('[pi-ws] Error handler error:', e);
        isProcessing = false;
      }
    };

    piWs.on('stream', handleStream);
    piWs.on('done', handleDone);
    piWs.on('error', handleError);

    // Auto-connect with smart URL (supports LAN/mobile access)
    if (!piWs.isConnected?.()) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const wsUrl = `${protocol}//${host}:8643`;
      console.log('[pi-ws] Connecting to', wsUrl);
      piWs.connect(wsUrl);
    }

    return () => {
      piWs.off('stream', handleStream);
      piWs.off('done', handleDone);
      piWs.off('error', handleError);
    };
  });
</script>

<div class="h-dvh flex flex-col md:flex-row overflow-hidden bg-zinc-50 text-zinc-950">
  
  <!-- Desktop Sidebar -->
  <div class="hidden md:flex w-80 flex-col border-r border-zinc-200 bg-white flex-shrink-0">
    <div class="p-4 border-b flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-blue-600 rounded-2xl flex items-center justify-center">
          <i class="fa-solid fa-robot text-white"></i>
        </div>
        <div>
          <div class="font-semibold text-xl">pi-ui</div>
          <div class="text-xs text-zinc-500">MVP</div>
        </div>
      </div>
      <button onclick={createNewSession} class="px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-2xl flex items-center gap-2">
        <i class="fa-solid fa-plus text-xs"></i>
        <span>New</span>
      </button>
    </div>

    <div class="p-4 border-b">
      <div class="text-xs text-zinc-500 mb-1">Model</div>
      <ModelSelector bind:value={currentModel} />
    </div>

    <div class="flex-1 overflow-auto p-2 min-h-0">
      <div class="text-xs text-zinc-500 px-3 py-2">Sessions</div>
      <SessionList
        {sessions}
        {activeSessionId}
        onSelect={selectSession}
      />
    </div>
  </div>

  <!-- Chat Area -->
  <div class="flex-1 flex flex-col bg-white min-h-0 relative">
    {#if activeSession}
      <!-- Header -->
      <div class="h-16 px-4 border-b flex items-center justify-between bg-white flex-shrink-0">
        <div class="flex items-center gap-3">
          <button onclick={toggleSessionsModal} class="md:hidden text-zinc-500 p-2 -ml-2">
            <i class="fa-solid fa-list text-xl"></i>
          </button>
          <div>
            <div class="font-semibold truncate">{activeSession.name}</div>
            <div class="flex items-center gap-2 text-xs text-zinc-500">
              <ModelSelector bind:value={activeSession.model} />
              <span>• {activeSession.status}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Messages Container -->
      <MessageList
        {messages}
        {showScrollButton}
        scrollToBottom={() => scrollToBottom()}
        {handleScroll}
        bind:messagesContainer
        {currentStreamingMessage}
      />

      <!-- Input Bar -->
      <ChatInput bind:newMessage={newMessage} {isProcessing} {sendMessage} {stopProcessing} />
    {/if}
  </div>
</div>

<!-- Mobile Sessions Modal -->
{#if showSessionsModal}
  <div class="md:hidden fixed inset-0 bg-black/50 z-50 flex items-end" onclick={toggleSessionsModal}>
    <div class="bg-white w-full rounded-t-3xl p-4 max-h-[70vh] overflow-auto" onclick={(e) => e.stopPropagation()}>
      <div class="flex justify-between items-center mb-4">
        <div class="font-semibold">Sessions</div>
        <button onclick={toggleSessionsModal} class="text-zinc-500">Close</button>
      </div>
      <SessionList
        {sessions}
        {activeSessionId}
        onSelect={selectSession}
      />
    </div>
  </div>
{/if}
