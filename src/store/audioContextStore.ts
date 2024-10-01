import { defineStore } from "pinia";

export const useAudioContextStore = defineStore('audiocontext', () => {
    const audioContext = new AudioContext();
    audioContext.suspend();
    window.addEventListener('click', () => {
        audioContext.resume();
    });
    return {
        audioContext,
    };
});