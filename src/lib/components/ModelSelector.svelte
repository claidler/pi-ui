<script>
  import { onMount } from 'svelte';
  import { piWs } from '$lib/services/pi-ws';

  let { value = $bindable(''), onChange = undefined } = $props();

  let models = $state([]);
  let loading = $state(true);

  // Group models by provider for optgroups
  function getGroupedModels() {
    const groups = {};
    for (const model of models) {
      if (!groups[model.provider]) groups[model.provider] = [];
      groups[model.provider].push(model);
    }
    return groups;
  }

  onMount(() => {
    // Listen for models list
    const handleModels = (modelList) => {
      models = modelList;
      loading = false;
      // Set default if no value is set
      if (!value && models.length > 0) {
        value = models[0].id;
      }
    };

    // Listen for WebSocket connection open
    const handleOpen = () => {
      console.log('[ModelSelector] WebSocket connected, requesting models');
      piWs.listModels();
    };

    piWs.on('models', handleModels);
    piWs.on('open', handleOpen);

    // If already connected, request immediately
    if (piWs.isConnected()) {
      console.log('[ModelSelector] Already connected, requesting models');
      piWs.listModels();
    }

    return () => {
      piWs.off('models', handleModels);
      piWs.off('open', handleOpen);
    };
  });
</script>

<select
  bind:value={value}
  onchange={onChange}
  class="bg-transparent border border-zinc-300 rounded-xl px-3 py-1 pr-8 text-sm focus:outline-none focus:border-blue-500 cursor-pointer max-w-[280px] truncate appearance-none bg-no-repeat"
  disabled={loading}
>
  {#if loading}
    <option>Loading models...</option>
  {:else if models.length === 0}
    <option>No models available</option>
  {:else}
    {#each Object.entries(getGroupedModels()) as [provider, providerModels]}
      <optgroup label={provider}>
        {#each providerModels as model}
          <option value={model.id}>{model.model}</option>
        {/each}
      </optgroup>
    {/each}
  {/if}
</select>

<style>
  select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-position: right 0.6rem center;
    background-size: 1rem;
  }
</style>
