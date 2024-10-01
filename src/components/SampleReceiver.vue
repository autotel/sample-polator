<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAnalysisStore } from '../store/analysisStore'
import { useAudioContextStore } from '../store/audioContextStore'
const dropArea = ref<HTMLElement | null>(null);
const analysisStore = useAnalysisStore();
const audioContextStore = useAudioContextStore();
const audioContext = audioContextStore.audioContext;
const fileToAudioBuffer = async (file: File) => {
    const reader = new FileReader()
    reader.readAsArrayBuffer(file)
    return new Promise<AudioBuffer>((resolve, reject) => {
        reader.onload = async () => {
            const buffer = await audioContext.decodeAudioData(reader.result as ArrayBuffer)
            resolve(buffer)
        }
        reader.onerror = reject
    })
}

const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    const files = [...(event.dataTransfer?.files || [])];
    console.log("drop", files);
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filename = file.name;
        fileToAudioBuffer(file).then((buffer) => {
            console.log('AudioBuffer', buffer);
            analysisStore.analyze(buffer, filename);
        })
    }

}

const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
}

const handleFileInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filename = file.name;
        fileToAudioBuffer(file).then((buffer) => {
            console.log('AudioBuffer', buffer);
            analysisStore.analyze(buffer, filename);
        })
    }
}

onMounted(() => {
    if (!dropArea.value) throw new Error('Drop area is not available');
    dropArea.value.addEventListener('drop', handleDrop);
    dropArea.value.addEventListener('dragover', handleDragOver);
})

onUnmounted(() => {
    if (!dropArea.value) throw new Error('Drop area is not available');
    dropArea.value.removeEventListener('drop', handleDrop);
    dropArea.value.removeEventListener('dragover', handleDragOver);
})


</script>
<template>
    <input class="drop-area" ref="dropArea" type="file" accept="audio/*" multiple @change="handleFileInput">
    <label for="fileInput">Drop the sample here</label>
    </input>
    <!-- <div ref="dropArea" class="drop-area">
        <p> Drop the sample here</p>
    </div> -->
</template>
<style scoped>
.drop-area {
    border: 2px dashed #ccc;
    border-radius: 20px;
    padding: 20px;
    text-align: center;
    font-size: 20px;
    color: #ccc;
    cursor: pointer;
}
</style>