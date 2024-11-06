<script>
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';

  const EXAMPLE_URL = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/hopper.webm';

  let dragging = writable(false);
  let audioElement;
  let videoElement;
  let fileInputRef;
  let currentTimeRef = 0;

  export let onInputChange;
  export let onTimeUpdate;

  const onBufferLoad = (arrayBuffer, type) => {
    const blob = new Blob([arrayBuffer.slice(0)], { type: type });
    const url = URL.createObjectURL(blob);
    processFile(arrayBuffer);

    if (type.startsWith('audio/')) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();

      audioElement.src = url;
    } else if (type.startsWith('video/')) {
      audioElement.pause();
      audioElement.removeAttribute('src');
      audioElement.load();

      videoElement.src = url;
    } else {
      alert(`Unsupported file type: ${type}`);
    }
  }

  const readFile = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      onBufferLoad(e.target.result, file.type);
    }
    reader.readAsArrayBuffer(file);
  }

  const handleInputChange = (event) => {
    readFile(event.target.files[0]);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    dragging.set(false);
    readFile(event.dataTransfer.files[0]);
  };

  const handleClick = (e) => {
    if (e.target.tagName === 'VIDEO' || e.target.tagName === 'AUDIO') {
      e.preventDefault();
      fileInputRef.click();
    } else if (e.target.tagName === 'INPUT') {
      e.stopPropagation();
    } else {
      fileInputRef.click();
      e.stopPropagation();
    }
  };

  const processFile = async (buffer) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16_000 });

    try {
      const audioBuffer = await audioContext.decodeAudioData(buffer);
      let audio;
      if (audioBuffer.numberOfChannels === 2) {
        const SCALING_FACTOR = Math.sqrt(2);
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        audio = new Float32Array(left.length);
        for (let i = 0; i < audioBuffer.length; ++i) {
          audio[i] = SCALING_FACTOR * (left[i] + right[i]) / 2;
        }
      } else {
        audio = audioBuffer.getChannelData(0);
      }
      onInputChange(audio);

    } catch (e) {
      alert(e);
    }
  };

  const updateTime = () => {
    let elem;
    if (audioElement?.src) {
      elem = audioElement;
    } else if (videoElement?.src) {
      elem = videoElement;
    }

    if (elem && currentTimeRef !== elem.currentTime) {
      currentTimeRef = elem.currentTime;
      onTimeUpdate(elem.currentTime);
    }

    requestAnimationFrame(updateTime);
  };

  onMount(() => {
    requestAnimationFrame(updateTime);
  });

  onDestroy(() => {
    cancelAnimationFrame(updateTime);
  });
</script>

<div
  on:click={handleClick}
  on:dragover={handleDragOver}
  on:drop={handleDrop}
  on:dragenter={() => dragging.set(true)}
  on:dragleave={() => dragging.set(false)}
>
  <input
    type="file"
    accept="audio/*,video/*"
    on:change={handleInputChange}
    bind:this={fileInputRef}
    class="hidden"
  />
  <audio
    bind:this={audioElement}
    controls
    style="display: {audioElement?.src ? 'block' : 'none'}"
    class="w-full max-h-full"
  />
  <video
    bind:this={videoElement}
    controls
    style="display: {videoElement?.src ? 'block' : 'none'}"
    class="w-full max-h-full"
  />
  {#if !audioElement?.src && !videoElement?.src}
    <div class="w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-md h-[250px]"
      style="border-color: {dragging ? 'blue' : 'lightgray'}"
    >
      <span class="text-gray-600 text-center"><u>Drag & drop</u> or <u>click</u><br />to select media</span>
      <span class="text-gray-500 text-sm hover:text-gray-800 mt-2" on:click={async (e) => {
        e.stopPropagation();
        const buffer = await fetch(EXAMPLE_URL).then((r) => r.arrayBuffer());
        videoElement.src = URL.createObjectURL(new Blob([buffer], { type: 'video/mp4' }));
        onBufferLoad(buffer, 'video/mp4');
      }}>(or <u>try an example</u>)</span>
    </div>
  {/if}
</div>
