<script>
  import ChatMessage from '$lib/components/ChatMessage.svelte';
  import ChatInput from '$lib/components/ChatInput.svelte';
  import MessageList from '$lib/components/MessageList.svelte';
  import SessionList from '$lib/components/SessionList.svelte';
  let sessions = $state([
    { id: 1, name: "Refactor auth module", model: "claude-3.5-sonnet", status: "thinking" },
    { id: 2, name: "Build landing page", model: "gpt-4o", status: "idle" },
    { id: 3, name: "Debug Pi agent connection", model: "claude-3.5-sonnet", status: "connected" }
  ]);

  let activeSessionId = $state(1);
  let activeSession = $derived(sessions.find(s => s.id === activeSessionId));
  
  let messages = $state([
    { role: "agent", content: "Starting task: Refactor auth module..." },
    { role: "agent", content: "Analyzing current auth implementation..." },
    { role: "tool", content: "Reading file: src/lib/auth.ts" },
    { role: "agent", content: "Found the issue. The current auth uses JWT but doesn't handle token refresh properly." },
    { role: "tool", content: "Reading file: src/lib/auth/refresh.ts" },
    { role: "agent", content: "I see the problem. The refresh token logic is incomplete." },
    { role: "user", content: "Can you fix the refresh logic?" },
    { role: "agent", content: "Yes, I'll implement a proper token refresh mechanism with retry logic." },
    { role: "tool", content: "Writing changes to src/lib/auth/refresh.ts" },
    { role: "agent", content: "Changes applied. Now testing the new refresh flow..." },
    { role: "agent", content: "All tests passing. Ready to commit the changes." }
  ]);

  let newMessage = $state("");
  let currentModel = $state("claude-3.5-sonnet");
  let showSessionsModal = $state(false);
  let isProcessing = $state(false);
  let showScrollButton = $state(false);
  let messagesContainer;

  function selectSession(id) {
    activeSessionId = id;
    showSessionsModal = false;
    // Scroll to bottom when switching sessions
    setTimeout(scrollToBottom, 100);
  }

  function sendMessage() {
    if (!newMessage.trim()) return;
    
    messages = [...messages, { role: "user", content: newMessage }];
    newMessage = "";
    isProcessing = true;

    setTimeout(() => {
      messages = [...messages, { role: "agent", content: "Got it. Working on that now..." }];
      isProcessing = false;
      scrollToBottom();
    }, 1200);
  }

  function stopProcessing() {
    isProcessing = false;
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
      isProcessing = false;
      sessions = [...sessions];
    }
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

  // Auto-scroll to bottom when new messages are added
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
      <select bind:value={currentModel} class="w-full border border-zinc-300 rounded-2xl px-3 py-2 text-sm">
        <option value="claude-3.5-sonnet">claude-3.5-sonnet</option>
        <option value="gpt-4o">gpt-4o</option>
        <option value="gemini-2.0-flash">gemini-2.0-flash</option>
      </select>
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
            <div class="text-xs text-zinc-500">{activeSession.model} • {activeSession.status}</div>
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
      />

      <!-- Input Bar -->
      <ChatInput bind:newMessage={newMessage} {isProcessing} {sendMessage} {stopProcessing} />
    {/if}
  </div>
</div>

<!-- Mobile Sessions Modal -->
{#if showSessionsModal}
  <div class="fixed inset-0 bg-black/40 z-50 md:hidden flex items-end" onclick={toggleSessionsModal}>
    <div class="bg-white w-full rounded-t-3xl max-h-[65vh] flex flex-col" onclick={e => e.stopPropagation()}>
      <div class="p-4 flex justify-between items-center border-b">
        <div class="font-semibold text-lg">Sessions</div>
        <button onclick={toggleSessionsModal} class="text-3xl leading-none">×</button>
      </div>
      <div class="overflow-auto flex-1 p-2">
        <SessionList
          {sessions}
          {activeSessionId}
          onSelect={(id) => { selectSession(id); toggleSessionsModal(); }}
        />
      </div>
      <div class="p-4 border-t">
        <button onclick={createNewSession} class="w-full py-3 bg-blue-600 text-white rounded-2xl font-medium">+ New Session</button>
      </div>
    </div>
  </div>
{/if}