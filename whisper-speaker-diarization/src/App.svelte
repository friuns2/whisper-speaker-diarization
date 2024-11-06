<script>
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import Progress from './components/Progress.svelte';
  import MediaInput from './components/MediaInput.svelte';
  import Transcript from './components/Transcript.svelte';
  import LanguageSelector from './components/LanguageSelector.svelte';

  let worker;
  const status = writable(null);
  const loadingMessage = writable('');
  const progressItems = writable([]);
  const audio = writable(null);
  const language = writable('en');
  const result = writable(null);
  const time = writable(null);
  const currentTime = writable(0);
  const device = writable('webgpu');
  const modelSize = writable(196);

  async function hasWebGPU() {
    if (!navigator.gpu) {
      return false;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch (e) {
      return false;
    }
  }

  onMount(async () => {
    const webgpuAvailable = await hasWebGPU();
    modelSize.set(webgpuAvailable ? 196 : 77);
    device.set(webgpuAvailable ? 'webgpu' : 'wasm');

    if (!worker) {
      worker = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module'
      });
    }

    const onMessageReceived = (e) => {
      switch (e.data.status) {
        case 'loading':
          status.set('loading');
          loadingMessage.set(e.data.data);
          break;
        case 'initiate':
          progressItems.update(items => [...items, e.data]);
          break;
        case 'progress':
          progressItems.update(items => items.map(item => {
            if (item.file === e.data.file) {
              return { ...item, ...e.data };
            }
            return item;
          }));
          break;
        case 'done':
          progressItems.update(items => items.filter(item => item.file !== e.data.file));
          break;
        case 'loaded':
          status.set('ready');
          break;
        case 'complete':
          result.set(e.data.result);
          time.set(e.data.time);
          status.set('ready');
          break;
      }
    };

    worker.addEventListener('message', onMessageReceived);

    return () => {
      worker.removeEventListener('message', onMessageReceived);
    };
  });

  function handleClick() {
    result.set(null);
    time.set(null);
    if (status === null) {
      status.set('loading');
      worker.postMessage({ type: 'load', data: { device } });
    } else {
      status.set('running');
      worker.postMessage({
        type: 'run', data: { audio, language }
      });
    }
  }
</script>

<div class="flex flex-col h-screen mx-auto text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 max-w-[600px]">
  {#if $status === 'loading'}
    <div class="flex justify-center items-center fixed w-screen h-screen bg-black z-10 bg-opacity-[92%] top-0 left-0">
      <div class="w-[500px]">
        <p class="text-center mb-1 text-white text-md">{$loadingMessage}</p>
        {#each $progressItems as { file, progress, total }, i}
          <Progress {file} {progress} {total} {i} />
        {/each}
      </div>
    </div>
  {/if}
  <div class="my-auto">
    <div class="flex flex-col items-center mb-2 text-center">
      <h1 class="text-5xl font-bold mb-2">Whisper Diarization</h1>
      <h2 class="text-xl font-semibold">In-browser automatic speech recognition w/ <br />word-level timestamps and speaker segmentation</h2>
    </div>

    <div class="w-full min-h-[220px] flex flex-col justify-center items-center">
      {#if !$audio}
        <p class="mb-2">
          You are about to download <a href="https://huggingface.co/onnx-community/whisper-base_timestamped" target="_blank" rel="noreferrer" class="font-medium underline">whisper-base</a> and <a href="https://huggingface.co/onnx-community/pyannote-segmentation-3.0" target="_blank" rel="noreferrer" class="font-medium underline">pyannote-segmentation-3.0</a>,
          two powerful speech recognition models for generating word-level timestamps across 100 different languages and speaker segmentation, respectively.
          Once loaded, the models ({$modelSize}MB + 6MB) will be cached and reused when you revisit the page.<br />
          <br />
          Everything runs locally in your browser using <a href="https://huggingface.co/docs/transformers.js" target="_blank" rel="noreferrer" class="underline">🤗&nbsp;Transformers.js</a> and ONNX Runtime Web,
          meaning no API calls are made to a server for inference. You can even disconnect from the internet after the model has loaded!
        </p>
      {/if}

      <div class="flex flex-col w-full m-3 max-w-[520px]">
        <span class="text-sm mb-0.5">Input audio/video</span>
        <MediaInput
          class="flex items-center border rounded-md cursor-pointer min-h-[100px] max-h-[500px] overflow-hidden"
          on:inputChange={(e) => {
            result.set(null);
            audio.set(e.detail);
          }}
          on:timeUpdate={(e) => currentTime.set(e.detail)}
        />
      </div>

      <div class="relative w-full flex justify-center items-center">
        <button
          class="border px-4 py-2 rounded-lg bg-blue-400 text-white hover:bg-blue-500 disabled:bg-blue-100 disabled:cursor-not-allowed select-none"
          on:click={handleClick}
          disabled={$status === 'running' || ($status !== null && $audio === null)}
        >
          {#if $status === null}
            Load model
          {:else if $status === 'running'}
            Running...
          {:else}
            Run model
          {/if}
        </button>

        {#if $status !== null}
          <div class='absolute right-0 bottom-0'>
            <span class="text-xs">Language:</span>
            <br />
            <LanguageSelector class="border rounded-lg p-1 max-w-[100px]" {language} />
          </div>
        {/if}
      </div>

      {#if $result && $time}
        <div class="w-full mt-4 border rounded-md">
          <Transcript
            class="p-2 max-h-[200px] overflow-y-auto scrollbar-thin select-none"
            {transcript}={$result.transcript}
            {segments}={$result.segments}
            {currentTime}={$currentTime}
            on:setCurrentTime={(e) => {
              currentTime.set(e.detail);
              mediaInputRef.current.setMediaTime(e.detail);
            }}
          />
        </div>
        <p class="text-sm text-gray-600 text-end p-1">Generation time: <span class="text-gray-800 font-semibold">{$time.toFixed(2)}ms</span></p>
      {/if}
    </div>
  </div>
</div>
