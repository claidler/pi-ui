<script>
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
    { role: "tool", content: "Reading file: src/lib/auth.ts" }
  ]);
  let newMessage = $state("");
  let currentModel = $state("claude-3.5-sonnet");
  let showSessionsModal = $state(false);

  function selectSession(id) {
    activeSessionId = id;
    showSessionsModal = false;
  }

  function sendMessage() {
    if (!newMessage.trim()) return;
    messages = [...messages, { role: "user", content: newMessage }];
    newMessage = "";
    setTimeout(() => {
      messages = [...messages, { role: "agent", content: "Working on that..." }];
    }, 700);
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
      sessions = [...sessions];
    }
  }

  function toggleSessionsModal() {
    showSessionsModal = !showSessionsModal;
  }
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
      <button on:click={createNewSession} class="px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-2xl flex items-center gap-2">
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
      {#each sessions as session}
        <button on:click={() => selectSession(session.id)} 
                class="w-full px-4 py-3 text-left rounded-2xl mb-1 hover:bg-zinc-100 flex justify-between items-center {activeSessionId === session.id ? 'bg-zinc-100 border border-zinc-300' : ''}">
          <div>
            <div class="font-medium text-sm">{session.name}</div>
            <div class="text-xs text-zinc-500">{session.model}</div>
          </div>
          {#if session.status === 'thinking'}
            <i class="fa-solid fa-spinner fa-spin text-emerald-500"></i>
          {:else if session.status === 'connected'}
            <div class="w-2 h-2 bg-emerald-500 rounded-full"></div>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Chat Area -->
  <div class="flex-1 flex flex-col bg-white min-h-0">
    {#if activeSession}
      <!-- Header -->
      <div class="h-16 px-4 border-b flex items-center justify-between bg-white flex-shrink-0">
        <div class="flex items-center gap-3">
          <button on:click={toggleSessionsModal} class="md:hidden text-zinc-500 p-2 -ml-2">
            <i class="fa-solid fa-list text-xl"></i>
          </button>
          <div>
            <div class="font-semibold truncate">{activeSession.name}</div>
            <div class="text-xs text-zinc-500">{activeSession.model} • {activeSession.status}</div>
          </div>
        </div>
        
        <button on:click={stopSession} class="px-4 py-2 text-sm border border-zinc-300 rounded-2xl flex items-center gap-2 hover:bg-red-50">
          <i class="fa-solid fa-stop"></i>
          <span class="hidden md:inline">Stop</span>
        </button>
      </div>

      <!-- Messages - Scrollable -->
      <div class="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-zinc-50 min-h-0">
        {#each messages as msg}
          <div class="flex {msg.role === 'user' ? 'justify-end' : ''}">
            <div class="max-w-[80%] px-4 py-3 rounded-3xl text-sm {msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-zinc-200'}">
              {#if msg.role === 'tool'}
                <div class="text-amber-600 text-xs font-mono mb-1">TOOL CALL</div>
              {/if}
              {msg.content}
            </div>
          </div>
        {/each}
      </div>

      <!-- Input Bar -->
      <div class="p-4 border-t bg-white flex-shrink-0">
        <div class="flex items-center gap-2 bg-white border border-zinc-300 rounded-3xl px-4 py-2">
          <input 
            bind:value={newMessage}
            on:keydown={e => e.key === 'Enter' && sendMessage()}
            type="text" 
            placeholder="Message the agent..." 
            class="flex-1 outline-none text-sm bg-transparent" 
          />
          <button on:click={sendMessage} class="w-9 h-9 bg-blue-600 text-white rounded-2xl flex items-center justify-center">
            <i class="fa-solid fa-arrow-up"></i>
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Mobile Sessions Modal -->
{#if showSessionsModal}
  <div class="fixed inset-0 bg-black/40 z-50 md:hidden flex items-end" on:click={toggleSessionsModal}>
    <div class="bg-white w-full rounded-t-3xl max-h-[65vh] flex flex-col" on:click|stopPropagation>
      <div class="p-4 flex justify-between items-center border-b">
        <div class="font-semibold text-lg">Sessions</div>
        <button on:click={toggleSessionsModal} class="text-3xl leading-none">×</button>
      </div>
      <div class="overflow-auto flex-1 p-2">
        {#each sessions as session}
          <button on:click={() => selectSession(session.id)} class="w-full px-4 py-4 text-left flex justify-between hover:bg-zinc-100 rounded-2xl {activeSessionId === session.id ? 'bg-zinc-100' : ''}">
            <div>
              <div class="font-medium">{session.name}</div>
              <div class="text-xs text-zinc-500">{session.model}</div>
            </div>
            {#if session.status === 'thinking'}
              <i class="fa-solid fa-spinner fa-spin text-emerald-500"></i>
            {/if}
          </button>
        {/each}
      </div>
      <div class="p-4 border-t">
        <button on:click={createNewSession} class="w-full py-3 bg-blue-600 text-white rounded-2xl font-medium">+ New Session</button>
      </div>
    </div>
  </div>
{/if}