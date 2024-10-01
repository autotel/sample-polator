<script setup lang="ts">
import SampleReceiver from './components/SampleReceiver.vue'
import { useAnalysisStore } from './store/analysisStore';
import Plotter from './components/Plotter.vue';
import { ref } from 'vue';
const loading = ref(false);
const analysisStore = useAnalysisStore();
const buildMultSample = async () => {
  loading.value = true;
  await analysisStore.buildMultSample();
  loading.value = false;
}

</script>

<template>
  <SampleReceiver />
  <template v-for="sample in analysisStore.currentAnalysis.samples">
    <div class="plot-group sample">
      <p>{{ sample.name }}</p>
      <Plotter :data="sample.timeData" :sampleRate="sample.sampleRate" name="time" />
      <Plotter :data="sample.frequencyData.real" :sampleRate="sample.sampleRate" name="f.real" />
      <Plotter :data="sample.frequencyData.imag" :sampleRate="sample.sampleRate" name="f.imaginary" />
    </div>
  </template>
  <template v-if="loading">
    <button disabled>Loading...</button>
  </template>
  <template v-else>
    <button @click="buildMultSample">Build Mult Sample</button>
  </template>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
