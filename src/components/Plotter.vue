<script setup lang="ts">
import { computed, ComputedRef, ref, watchEffect } from 'vue';
import { useAudioContextStore } from '../store/audioContextStore';

const props = defineProps<{
    data: Float32Array | number[],
    name: string,
    sampleRate: number,
}>();
const audioContextStore = useAudioContextStore();
type microVec = [number, number];
const canvasSize: ComputedRef<microVec> = computed(()=>[Math.min(4096,props.data.length), 500]);
const canvas = ref<HTMLCanvasElement | null>(null);
const isPlaying = ref(false);

let valueRange = computed<[number, number]>(() => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < props.data.length; i++) {
        const vs = props.data[i];
        if(vs === Infinity || vs === -Infinity) continue;
        if(isNaN(vs)) continue;
        min = Math.min(min, vs);
        max = Math.max(max, vs);
    }
    return [min, max];
})

let context = computed(() => canvas.value?.getContext('2d'));
watchEffect(() => {
    if (canvas.value) {
        draw(props.data);
    }
})


const getWaveValueAt = (wave: Float32Array | number[], iMin: number, iMax: number) => {
    if (iMax >= wave.length) iMax = wave.length - 1;
    if (iMax > iMin + 1) {
        let max = -1;
        let min = 1;
        let startIndex = Math.floor(iMin);
        let endIndex = Math.ceil(iMax);
        for (let j = startIndex; j <= endIndex; j++) {
            const vs = wave[j];
            max = Math.max(max, vs);
            min = Math.min(min, vs);
        }
        return [min, max];
    } else {
        const vs = wave[Math.floor(iMin)];
        return [vs, vs];
    }
}

const playMe = () => {
    if (isPlaying.value) return;
    isPlaying.value = true;
    const wave = props.data;
    const audioBuffer = new AudioBuffer({
        length: wave.length,
        numberOfChannels: 1,
        sampleRate: props.sampleRate,
    });
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < wave.length; i++) {
        channelData[i] = wave[i];
    }
    const audioSource = audioContextStore.audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(audioContextStore.audioContext.destination);
    audioSource.start();
    audioSource.onended = () => {
        audioSource.disconnect();
        isPlaying.value = false;
    }
}

const draw = (wave: Float32Array | number[]) => {
    if (!context.value) return;
    const ctx = context.value;
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, ...canvasSize.value);
    const offsetY = canvasSize.value[1] / 2;
    const offsetVal = valueRange.value[0];
    const range = valueRange.value[1] - valueRange.value[0];
    console.log('range', range, offsetVal);
    const valToY = (val: number) => (val + offsetVal) * offsetY / range + offsetY;



    const refLines = [
        0, 1, 10, 100, 1000, 10000
    ];
    refLines.push(...refLines.map(v => -v));
    for(let vy of refLines) {
        const y = valToY(vy);
        ctx.beginPath();
        ctx.strokeStyle = '#555555';
        ctx.moveTo(0, y);
        ctx.lineTo(canvasSize.value[0], y);
        ctx.stroke();
        ctx.fillStyle = '#555555';
        ctx.fillText(vy+'', 0, y);
    }


    ctx.beginPath();
    ctx.strokeStyle = '#FAD3FA';

    if (wave.length < canvasSize.value[0]) {
        const scalex = canvasSize.value[0] / wave.length;
        for (let i = 0; i < wave.length; i++) {
            const x = i * scalex;
            const y = valToY(wave[i]);
            ctx[i ? 'lineTo' : 'moveTo'](x, y);
        }
    } else {
        const scalei = wave.length / canvasSize.value[0];
        for (let i = 0; i < canvasSize.value[0]; i++) {
            const [min, max] = getWaveValueAt(wave, i * scalei, (i + 1) * scalei);
            ctx[i ? 'lineTo' : 'moveTo'](i, valToY(min));
            ctx.lineTo(i,valToY(max));
        }
    }
    ctx.stroke();
}


</script>

<template>
    {{ name }} {{ valueRange }} {{ sampleRate }} {{(data.length / sampleRate).toFixed(1)}}s <button @click="playMe" :disabled="isPlaying">Play</button>
    <div class="plotter">
        <canvas ref="canvas" :width="canvasSize[0]" :height="canvasSize[1]"></canvas>
    </div>
</template>

<style scoped>
.plotter {
    width: 100%;
    height: auto;
    background-color: #000000;
    overflow-y: auto;
}   
</style>