<script lang="ts">
  import ChatInput from '$lib/components/ChatInput.svelte';
  import MessageList from '$lib/components/MessageList.svelte';
  import SessionList from '$lib/components/SessionList.svelte';
  import ModelSelector from '$lib/components/ModelSelector.svelte';
  import WorkspacePicker from '$lib/components/WorkspacePicker.svelte';
  import { piWs } from '$lib/services/pi-ws';
  import {
    getWorkspaceHome,
    repairLegacyWorkspacePath,
    resolveWorkspace,
    setWorkspaceHome
  } from '$lib/workspace';

  interface Session {
    id: string;
    name: string;
    path: string;
    workspace: string;
    model: string;
    status: string;
    createdAt: string;
  }

  interface Msg {
    role: string;
    content: string;
    toolCallId?: string;
    toolName?: string;
  }

  let groups = $state<Record<string, Session[]>>({});
  let activeSessionId = $state<string | null>(null);
  const WORKSPACE_STORAGE_KEY = 'pi-ui:workspace';
  function getSavedWorkspace(): string {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (saved) return repairLegacyWorkspacePath(saved);
    }
    return getWorkspaceHome();
  }
  let activeWorkspace = $state<string>(getSavedWorkspace());
  let workspaceSuggestions = $derived(Object.keys(groups));
  let allSessions = $derived(Object.values(groups).flat());
  let activeSession = $derived(allSessions.find(s => s.id === activeSessionId));
  let sessionCount = $derived(allSessions.length);

  let messages = $state<Msg[]>([]);
  let newMessage = $state("");
  const MODEL_STORAGE_KEY = 'pi-ui:selected-model';
  function getSavedModel(): string {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      if (saved) return saved;
    }
    return 'github-copilot/claude-sonnet-4.5';
  }
  let currentModel = $state(getSavedModel());
  let showSessionsModal = $state(false);
  let isProcessing = $state(false);
  let showScrollButton = $state(false);
  let messagesContainer: HTMLDivElement | undefined = $state(undefined);
  let currentStreamingMessage = $state("");
  let loadingSessions = $state(true);
  let loadingMessages = $state(false);

  async function loadSessions() {
    loadingSessions = true;
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      groups = data.groups || {};
      if (allSessions.length > 0 && !activeSessionId) {
        selectSession(allSessions[0].id);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      loadingSessions = false;
    }
  }

  async function loadMessages(sessionId: string) {
    loadingMessages = true;
    try {
      const session = allSessions.find(s => s.id === sessionId);
      if (!session) return;
      if (!session.path) {
        messages = [];
        return;
      }
      const res = await fetch(`/api/sessions/${session.path}`);
      const data = await res.json();
      messages = data.messages || [];
    } catch (err) {
      console.error('Failed to load messages:', err);
      messages = [];
    } finally {
      loadingMessages = false;
    }
  }

  function selectSession(id: string) {
    activeSessionId = id;
    showSessionsModal = false;
    const session = allSessions.find(s => s.id === id);
    if (session?.workspace) {
      setWorkspace(session.workspace);
    }
    loadMessages(id);
    setTimeout(scrollToBottom, 100);
  }

  function setWorkspace(workspace: string) {
    activeWorkspace = resolveWorkspace(workspace);
    if (typeof window !== 'undefined') {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, activeWorkspace);
    }
    const session = allSessions.find(s => s.id === activeSessionId);
    if (session && !session.path) {
      session.workspace = activeWorkspace;
      groups = groups;
    }
  }

  function selectWorkspace(workspace: string) {
    setWorkspace(workspace);
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
      sessionId: activeSessionId ?? undefined,
      cwd: activeWorkspace
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
    const newId = crypto.randomUUID();
    const ws = resolveWorkspace(activeWorkspace);
    if (!groups[ws]) groups[ws] = [];
    groups[ws].unshift({
      id: newId,
      name: "New session",
      path: '',
      workspace: ws,
      model: currentModel,
      status: "idle",
      createdAt: new Date().toISOString()
    });
    groups = groups;
    selectSession(newId);
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

  // Persist model selection to localStorage
  $effect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MODEL_STORAGE_KEY, currentModel);
    }
  });

  // Load sessions on mount
  $effect(() => {
    loadSessions();
  });

  $effect(() => {
    fetch('/api/workspace')
      .then((r) => r.json())
      .then((data) => {
        if (data.home) setWorkspaceHome(data.home);
      })
      .catch(() => {});
  });

  // WebSocket streaming handlers
  $effect(() => {
    const handleStream = (chunk: any) => {
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

    const handleError = (err: any) => {
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
          <div class="text-xs text-zinc-500">{sessionCount} sessions</div>
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
      {#if loadingSessions}
        <div class="px-4 py-8 text-center text-sm text-zinc-400">
          <div class="w-5 h-5 border-2 border-zinc-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
          Loading sessions…
        </div>
      {:else if sessionCount === 0}
        <div class="px-4 py-8 text-center text-sm text-zinc-400">No sessions found</div>
      {:else}
        <SessionList
          {groups}
          {activeSessionId}
          {activeWorkspace}
          onSelect={selectSession}
          onWorkspaceSelect={selectWorkspace}
        />
      {/if}
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
          <div class="min-w-0">
            <div class="font-semibold truncate">{activeSession.name}</div>
            <div class="flex items-center gap-1.5 text-xs text-zinc-500 min-w-0">
              <i class="fa-solid fa-folder text-[10px] text-zinc-400 flex-shrink-0" aria-hidden="true"></i>
              <WorkspacePicker
                bind:value={activeWorkspace}
                suggestions={workspaceSuggestions}
                sessionWorkspace={activeSession.path ? activeSession.workspace : undefined}
                onChange={setWorkspace}
              />
              <span class="flex-shrink-0">• {activeSession.status}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Messages Container -->
      {#if loadingMessages}
        <div class="flex-1 flex items-center justify-center bg-zinc-50">
          <div class="text-center text-zinc-400">
            <div class="w-6 h-6 border-2 border-zinc-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
            <div class="text-sm">Loading messages…</div>
          </div>
        </div>
      {:else if messages.length === 0}
        <div class="flex-1 flex items-center justify-center bg-zinc-50">
          <div class="text-center text-zinc-400 text-sm">No messages in this session yet</div>
        </div>
      {:else}
        <MessageList
          {messages}
          {showScrollButton}
          scrollToBottom={() => scrollToBottom()}
          {handleScroll}
          bind:messagesContainer
          {currentStreamingMessage}
          {isProcessing}
        />
      {/if}

      <!-- Input Bar -->
      <ChatInput bind:newMessage={newMessage} {isProcessing} {sendMessage} {stopProcessing} />
    {:else}
      <div class="flex-1 flex items-center justify-center bg-zinc-50">
        <div class="text-center text-zinc-400">
          <div class="text-4xl mb-4">🤖</div>
          <div class="text-lg font-medium mb-1">pi-ui</div>
          <div class="text-sm">Select a session to view messages</div>
        </div>
      </div>
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
      {#if loadingSessions}
        <div class="py-8 text-center text-sm text-zinc-400">Loading…</div>
      {:else}
        <SessionList
          {groups}
          {activeSessionId}
          {activeWorkspace}
          onSelect={selectSession}
          onWorkspaceSelect={selectWorkspace}
        />
      {/if}
    </div>
  </div>
{/if}
