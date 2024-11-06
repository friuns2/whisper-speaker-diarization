<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  export let transcript;
  export let segments;
  export let currentTime;
  export let setCurrentTime;

  const jsonTranscript = writable('');
  const postProcessedTranscript = writable([]);

  onMount(() => {
    jsonTranscript.set(JSON.stringify({
      ...transcript,
      segments,
    }, null, 2)
      .replace(/( {4}"timestamp": )\[\s+(\S+)\s+(\S+)\s+\]/gm, "$1[$2 $3]"));

    let prev = 0;
    const words = transcript.chunks;
    const result = [];
    for (const segment of segments) {
      const { label, end } = segment;
      if (label === 'NO_SPEAKER') continue;

      const segmentWords = [];
      for (let i = prev; i < words.length; ++i) {
        const word = words[i];
        if (word.timestamp[1] <= end) {
          segmentWords.push(word);
        } else {
          prev = i;
          break;
        }
      }
      if (segmentWords.length > 0) {
        result.push({
          ...segment,
          chunks: segmentWords,
        });
      }
    }
    postProcessedTranscript.set(result);
  });

  function downloadTranscript() {
    const blob = new Blob([$jsonTranscript], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript.json';
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div>
  {#each $postProcessedTranscript as { label, start, end, chunks }, i}
    <div class="border-t py-2" key={i}>
      <div class="flex justify-between">
        <label class="text-xs font-medium">{label}</label>
        <label class="text-xs">{start.toFixed(2)} &rarr; {end.toFixed(2)}</label>
      </div>
      <div>
        {#each chunks as chunk, j}
          <span key={j}>
            {chunk.text.startsWith(' ') ? " " : ""}
            <span
              on:click={() => setCurrentTime(chunk.timestamp[0])}
              class="text-md text-gray-600 cursor-pointer hover:text-red-600"
              title={chunk.timestamp.map(x => x.toFixed(2)).join(' → ')}
              style="text-decoration: {chunk.timestamp[0] <= currentTime && currentTime < chunk.timestamp[1] ? 'underline' : 'none'}; text-shadow: {chunk.timestamp[0] <= currentTime && currentTime < chunk.timestamp[1] ? '0 0 1px #000' : 'none'}"
            >{chunk.text.trim()}</span>
          </span>
        {/each}
      </div>
    </div>
  {/each}
</div>

<div class="flex justify-center border-t text-sm text-gray-600 max-h-[150px] overflow-y-auto p-2 scrollbar-thin">
  <button
    class="flex items-center border px-2 py-1 rounded-lg bg-green-400 text-white hover:bg-green-500"
    on:click={downloadTranscript}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" class="size-6 mr-1">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
    Download transcript
  </button>
</div>
