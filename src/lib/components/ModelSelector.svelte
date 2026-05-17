<script>
  /** @type {string} */
  let { value = $bindable(''), onChange } = $props();

  const models = [
    'claude-3.5-sonnet',
    'gpt-4o',
    'gemini-2.0-flash'
  ];
</script>

<select
  bind:value={value}
  onchange={onChange}
  class="bg-transparent border border-zinc-300 rounded-xl px-3 py-1 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
>
  {#each models as model}
    <option value={model}>{model}</option>
  {/each}
</select>
