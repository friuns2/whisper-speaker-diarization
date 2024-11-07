import { signal, computed, effect, batch } from '@preact/signals';

import Progress from './components/Progress';
import MediaInput from './components/MediaInput';
import Transcript from './components/Transcript';
import LanguageSelector from './components/LanguageSelector';


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

function App() {

    // Create a reference to the worker object.
    const worker = signal(null);

    // Model loading and progress
    const status = signal(null);
    const loadingMessage = signal('');
    const progressItems = signal([]);

    const mediaInputRef = signal(null);
    const audio = signal(null);
    const language = signal('en');

    const result = signal(null);
    const time = signal(null);
    const currentTime = signal(0);

    const device = signal('webgpu'); // Try use WebGPU first
    const modelSize = signal('gpu' in navigator ? 196 : 77); // WebGPU=196MB, WebAssembly=77MB
    effect(() => {
        hasWebGPU().then((b) => {
            modelSize.value = b ? 196 : 77;
            device.value = b ? 'webgpu' : 'wasm';
        });
    });

    // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
    effect(() => {
        if (!worker.value) {
            // Create the worker if it does not yet exist.
            worker.value = new Worker(new URL('./worker.js', import.meta.url), {
                type: 'module'
            });
        }

        // Create a callback function for messages from the worker thread.
        const onMessageReceived = (e) => {
            switch (e.data.status) {
                case 'loading':
                    // Model file start load: add a new progress item to the list.
                    status.value = 'loading';
                    loadingMessage.value = e.data.data;
                    break;

                case 'initiate':
                    progressItems.value = [...progressItems.value, e.data];
                    break;

                case 'progress':
                    // Model file progress: update one of the progress items.
                    progressItems.value = progressItems.value.map(item => {
                        if (item.file === e.data.file) {
                            return { ...item, ...e.data }
                        }
                        return item;
                    });
                    break;

                case 'done':
                    // Model file loaded: remove the progress item from the list.
                    progressItems.value = progressItems.value.filter(item => item.file !== e.data.file);
                    break;

                case 'loaded':
                    // Pipeline ready: the worker is ready to accept messages.
                    status.value = 'ready';
                    break;

                case 'complete':
                    result.value = e.data.result;
                    time.value = e.data.time;
                    status.value = 'ready';
                    break;
            }
        };

        // Attach the callback function as an event listener.
        worker.value.addEventListener('message', onMessageReceived);

        // Define a cleanup function for when the component is unmounted.
        return () => {
            worker.value.removeEventListener('message', onMessageReceived);
        };
    });

    const handleClick = computed(() => () => {
        result.value = null;
        time.value = null;
        if (status.value === null) {
            status.value = 'loading';
            worker.value.postMessage({ type: 'load', data: { device: device.value } });
        } else {
            status.value = 'running';
            worker.value.postMessage({
                type: 'run', data: { audio: audio.value, language: language.value }
            });
        }
    });

    return (
        <div className="flex flex-col h-screen mx-auto text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 max-w-[600px]">

            {status.value === 'loading' && (
                <div className="flex justify-center items-center fixed w-screen h-screen bg-black z-10 bg-opacity-[92%] top-0 left-0">
                    <div className="w-[500px]">
                        <p className="text-center mb-1 text-white text-md">{loadingMessage.value}</p>
                        {progressItems.value.map(({ file, progress, total }, i) => (
                            <Progress key={i} text={file} percentage={progress} total={total} />
                        ))}
                    </div>
                </div>
            )}
            <div className="my-auto">
                <div className="flex flex-col items-center mb-2 text-center">
                    <h1 className="text-5xl font-bold mb-2">Whisper Diarization</h1>
                    <h2 className="text-xl font-semibold">In-browser automatic speech recognition w/ <br />word-level timestamps and speaker segmentation</h2>
                </div>

                <div className="w-full min-h-[220px] flex flex-col justify-center items-center">
                    {
                        !audio.value && (
                            <p className="mb-2">
                                You are about to download <a href="https://huggingface.co/onnx-community/whisper-base_timestamped" target="_blank" rel="noreferrer" className="font-medium underline">whisper-base</a> and <a href="https://huggingface.co/onnx-community/pyannote-segmentation-3.0" target="_blank" rel="noreferrer" className="font-medium underline">pyannote-segmentation-3.0</a>,
                                two powerful speech recognition models for generating word-level timestamps across 100 different languages and speaker segmentation, respectively.
                                Once loaded, the models ({modelSize.value}MB + 6MB) will be cached and reused when you revisit the page.<br />
                                <br />
                                Everything runs locally in your browser using <a href="https://huggingface.co/docs/transformers.js" target="_blank" rel="noreferrer" className="underline">🤗&nbsp;Transformers.js</a> and ONNX Runtime Web,
                                meaning no API calls are made to a server for inference. You can even disconnect from the internet after the model has loaded!
                            </p>
                        )
                    }

                    <div className="flex flex-col w-full m-3 max-w-[520px]">
                        <span className="text-sm mb-0.5">Input audio/video</span>
                        <MediaInput
                            ref={mediaInputRef.value}
                            className="flex items-center border rounded-md cursor-pointer min-h-[100px] max-h-[500px] overflow-hidden"
                            onInputChange={(audio) => {
                                result.value = null;
                                audio.value = audio;
                            }}
                            onTimeUpdate={(time) => currentTime.value = time}
                        />
                    </div>

                    <div className="relative w-full flex justify-center items-center">
                        <button
                            className="border px-4 py-2 rounded-lg bg-blue-400 text-white hover:bg-blue-500 disabled:bg-blue-100 disabled:cursor-not-allowed select-none"
                            onClick={handleClick.value}
                            disabled={status.value === 'running' || (status.value !== null && audio.value === null)}
                        >
                            {status.value === null ? 'Load model' :
                                status.value === 'running'
                                    ? 'Running...'
                                    : 'Run model'
                            }
                        </button>

                        {status.value !== null &&
                            <div className='absolute right-0 bottom-0'>
                                <span className="text-xs">Language:</span>
                                <br />
                                <LanguageSelector className="border rounded-lg p-1 max-w-[100px]" language={language.value} setLanguage={setLanguage} />
                            </div>
                        }
                    </div>

                    {
                        result.value && time.value && (
                            <>
                                <div className="w-full mt-4 border rounded-md">
                                    <Transcript
                                        className="p-2 max-h-[200px] overflow-y-auto scrollbar-thin select-none"
                                        transcript={result.value.transcript}
                                        segments={result.value.segments}
                                        currentTime={currentTime.value}
                                        setCurrentTime={(time) => {
                                            currentTime.value = time;
                                            mediaInputRef.value.setMediaTime(time);
                                        }}
                                    />
                                </div>
                                <p className="text-sm text-gray-600 text-end p-1">Generation time: <span className="text-gray-800 font-semibold">{time.value.toFixed(2)}ms</span></p>
                            </>
                        )
                    }
                </div>
            </div>
        </div >
    )
}

export default App
