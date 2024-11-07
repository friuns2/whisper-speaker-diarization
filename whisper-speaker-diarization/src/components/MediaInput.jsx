import { signal, effect } from '@preact/signals';
import { forwardRef, useImperativeHandle } from 'react';

const EXAMPLE_URL = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/hopper.webm';

const MediaInput = forwardRef(({ onInputChange, onTimeUpdate, ...props }, ref) => {
    // UI states
    const dragging = signal(false);
    const fileInputRef = signal(null);

    // Create a reference to the audio and video elements
    const audioElement = signal(null);
    const videoElement = signal(null);

    const currentTimeRef = signal(0);
    useImperativeHandle(ref, () => ({
        setMediaTime(time) {
            if (audioElement.value?.src) {
                audioElement.value.currentTime = time;
            } else if (videoElement.value?.src) {
                videoElement.value.currentTime = time;
            }
            currentTimeRef.value = time;
        }
    }));

    const onBufferLoad = (arrayBuffer, type) => {
        const blob = new Blob([arrayBuffer.slice(0)], { type: type });
        const url = URL.createObjectURL(blob);
        processFile(arrayBuffer);

        // Create a URL for the Blob
        if (type.startsWith('audio/')) {
            // Dispose the previous source
            videoElement.value.pause();
            videoElement.value.removeAttribute('src');
            videoElement.value.load();

            audioElement.value.src = url;
        } else if (type.startsWith('video/')) {
            // Dispose the previous source
            audioElement.value.pause();
            audioElement.value.removeAttribute('src');
            audioElement.value.load();

            videoElement.value.src = url;
        } else {
            alert(`Unsupported file type: ${type}`);
        }
    }

    const readFile = (file) => {
        if (!file) return;

        // file.type
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
        dragging.value = false;
        readFile(event.dataTransfer.files[0]);
    };

    const handleClick = (e) => {
        if (e.target.tagName === 'VIDEO' || e.target.tagName === 'AUDIO') {
            e.preventDefault();
            fileInputRef.value.click();
        } else if (e.target.tagName === 'INPUT') {
            e.stopPropagation();
        } else {
            fileInputRef.value.click();
            e.stopPropagation();
        }
    };

    const processFile = async (buffer) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16_000 });

        try {
            const audioBuffer = await audioContext.decodeAudioData(buffer);
            let audio;
            if (audioBuffer.numberOfChannels === 2) {
                // Merge channels
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

    const requestRef = signal(null);

    const updateTime = () => {
        let elem;
        if (audioElement.value?.src) {
            elem = audioElement.value;

        } else if (videoElement.value?.src) {
            elem = videoElement.value;
        }

        if (elem && currentTimeRef.value !== elem.currentTime) {
            currentTimeRef.value = elem.currentTime;
            onTimeUpdate(elem.currentTime);
        }

        // Request the next frame
        requestRef.value = requestAnimationFrame(updateTime);
    };

    effect(() => {
        // Start the animation
        requestRef.value = requestAnimationFrame(updateTime);

        return () => {
            // Cleanup on component unmount
            cancelAnimationFrame(requestRef.value);
        };
    });
    return (
        <div
            {...props}
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnter={(e) => dragging.value = true}
            onDragLeave={(e) => dragging.value = false}
        >
            <input
                type="file"
                accept="audio/*,video/*"
                onChange={handleInputChange}
                ref={fileInputRef}
                className="hidden"
            />
            {
                <audio
                    ref={audioElement}
                    controls
                    style={{ display: audioElement.value?.src ? 'block' : 'none' }}
                    className='w-full max-h-full'
                />
            }
            {
                <video
                    ref={videoElement}
                    controls
                    style={{ display: videoElement.value?.src ? 'block' : 'none' }}
                    className='w-full max-h-full'
                />
            }
            {
                !audioElement.value?.src && !videoElement.value?.src && (
                    <div className="w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-md h-[250px]"
                        style={{ borderColor: dragging.value ? 'blue' : 'lightgray' }}
                    >
                        <span className="text-gray-600 text-center"><u>Drag & drop</u> or <u>click</u><br />to select media</span>
                        <span className="text-gray-500 text-sm hover:text-gray-800 mt-2" onClick={async (e) => {
                            e.stopPropagation();
                            const buffer = await fetch(EXAMPLE_URL).then((r) => r.arrayBuffer());
                            videoElement.value.src = URL.createObjectURL(new Blob([buffer], { type: 'video/mp4' }));
                            onBufferLoad(buffer, 'video/mp4');
                        }}>(or <u>try an example</u>)</span>
                    </div>
                )
            }
        </div>
    );
});
MediaInput.displayName = 'MediaInput';

export default MediaInput;
