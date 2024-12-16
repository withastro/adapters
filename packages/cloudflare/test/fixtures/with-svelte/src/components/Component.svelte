<script>
  import { setContext, onMount } from 'svelte';

  setContext('svelte', true);
  onMount(() => {
    console.log('The component has mounted!');
  });
</script>
<div class="svelte">Svelte Content</div>
