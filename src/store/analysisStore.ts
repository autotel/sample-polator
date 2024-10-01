import { defineStore } from "pinia";
import { reactive } from "vue";
import { useAudioContextStore } from "./audioContextStore";
import ftWorker from '../workers/ft.worker.js?worker';
export type EitherFloatArray = Float32Array | number[];

export interface ImagAndReal {
    real: EitherFloatArray,
    imag: EitherFloatArray,
};
export interface AnalyzedSample<name = string> {
    name: name;
    timeData: EitherFloatArray;
    frequencyData: ImagAndReal;
    sampleRate: number;
}
export interface Analysis {
    samples: AnalyzedSample[];
}

interface FWorkerResponse {
    id: string | number,
    operation: 'ft' | 'ifft',
    result?: {
        real: EitherFloatArray,
        imag: EitherFloatArray,
    },
    err: any
}
interface FWorkerRequest {
    id: string | number,
    operation: 'ft' | 'ifft',
    data: Float32Array | ImagAndReal,
    err: any
}

interface NormalizedData {
    data: Float32Array,
    factor: number,
    bias: number,
}

const normalizeData = (data: EitherFloatArray): NormalizedData => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const factor = 1 / (max - min);

    const normalizedData = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
        normalizedData[i] = (data[i] - min) * factor;
    }
    return {
        data: normalizedData,
        factor,
        bias: min,
    };
}
const denormalizeData = (data: NormalizedData): Float32Array => {
    const denormalizedData = new Float32Array(data.data.length);
    for (let i = 0; i < data.data.length; i++) {
        denormalizedData[i] = data.data[i] / data.factor + data.bias;
    }
    return denormalizedData;
}
const factorAndBiasAggregator = (a: number, b: number) => {
    return a * b;
}
const multiplyDataNormalized = (data1: EitherFloatArray, data2: EitherFloatArray): Float32Array => {
    const mult = new Float32Array(data1.length);
    let maxLength = Math.max(data1.length, data2.length);
    const max1 = Math.max(...data1);
    const max2 = Math.max(...data2);
    const maxRange = Math.max(max1, max2);
    for(let i = 0; i < maxLength; i++) {
        const sign = Math.sign(data1[i] * data2[i]);
        mult[i] = Math.sqrt(data1[i] * data1[i] + data2[i]* data2[i])  * sign;
    }
    return mult;
}
const objectRequireFields = (obj: any, fields: string[]) => {
    fields.forEach((field) => {
        if (!obj.hasOwnProperty(field)) {
            console.error(obj);
            throw new Error(`Field ${field} is missing in object`);
        }
    });
}
const forceLengthToPowerOfTwo = (arr: Float32Array | number[]) => {
    const newLength = Math.pow(2, Math.ceil(Math.log2(arr.length)));
    const newArr = new Float32Array(newLength);
    newArr.set(arr);
    return newArr;
}

const clip = (val: number) => {
    if (val > 1) return 1;
    if (val < -1) return -1;
    return val;
}


export const useAnalysisStore = defineStore('analysis', () => {
    const contextStore = useAudioContextStore();
    const audiocontext = contextStore.audioContext;
    const offlineAudioContext = new OfflineAudioContext(1, 1, audiocontext.sampleRate);
    const currentAnalysis = reactive<Analysis>({
        samples: [],
    });

    const makeRequest = (operation: 'ft' | 'ifft', data: Float32Array | ImagAndReal): Promise<FWorkerResponse> => {
        return new Promise((resolve, reject) => {
            const worker = new ftWorker();
            console.log("posting message");
            const req: FWorkerRequest = {
                id: operation,
                operation,
                data,
                err: null,
            };
            worker.postMessage(req);
            worker.onmessage = (evt) => {
                let parsedData = evt.data;
                try {
                    parsedData = (evt.data);
                    objectRequireFields(parsedData, ['id', 'err']);
                } catch (err) {
                    console.error('error with response data', evt.data, err);
                    reject(err);
                    return;
                }
                const evtData = parsedData as FWorkerResponse;
                if (evtData.err && evtData.result === undefined) {
                    reject(evtData.err);
                } else {
                    if (evtData.err) {
                        console.error(evtData.err);
                    }
                    resolve(evtData);
                }
            }
        });
    }
    const getFt = (data: Float32Array): Promise<FWorkerResponse> => {
        return makeRequest('ft', data);
    }
    const getIfFt = (data: ImagAndReal): Promise<FWorkerResponse> => {
        return makeRequest('ifft', data);
    }

    const analyze = async (sourceBuffer: AudioBuffer, name: string) => {
        const sourceData = sourceBuffer.getChannelData(0);
        const lenghthenedData = forceLengthToPowerOfTwo(sourceData);
        console.log('analyzing', name);
        const promises = [] as Promise<FWorkerResponse>[];

        const ftPromise = getFt(lenghthenedData);
        ftPromise.then((resp) => {
            console.log('ft ready', resp);
        })

        promises.push(ftPromise);
        const [ftResp] = await Promise.all(promises);

        const frequencyData = ftResp.result;
        if (frequencyData === undefined) throw new Error('no frequency data where expected');
        console.log('frequency data', frequencyData);
        currentAnalysis.samples.push({
            name,
            timeData: sourceData,
            frequencyData,
            sampleRate: sourceBuffer.sampleRate,
        });
    }
    const buildMultSample = async () => {
        const samples = currentAnalysis.samples;
        if (samples.length === 0) {
            console.error('no samples to build mult sample');
            return;
        }
        const sample = samples[0];
        const multSample = {
            name: 'mult',
            timeData: sample.timeData,
            frequencyData: {
                real: sample.frequencyData.real,
                imag: sample.frequencyData.imag,
            },
            sampleRate: sample.sampleRate,
        } as AnalyzedSample;
        
        for (let i = 1; i < samples.length; i++) {
            const s = samples[i];
            multSample.frequencyData.real = multiplyDataNormalized(multSample.frequencyData.real, s.frequencyData.real);
            multSample.frequencyData.imag = multiplyDataNormalized(multSample.frequencyData.imag, s.frequencyData.imag);
        }
        const calc = await getIfFt(multSample.frequencyData);
        console.log("IFT is ready", calc);
        if (!calc.result) throw new Error('no result in ifft');
        multSample.timeData = calc.result.real.map(clip);
        currentAnalysis.samples.push(multSample);
    }
    /*
        
        when new analysis added, do:

    * normalize frequencyData from -1 to 1 or 0 to 1 IDK
    * generate "fixed" tdata: multiply all the frequencyDatas accross
    * generate "variadic" tdata: multiply all the frequencyDatas, but aligning them to the same frequency (use interpolation for more precision?)
    * convert both datas to time domain resulting in samples
    * 
    * advanced:
    * somehow measure the "noise" and create a convolution
    * when playing the sample feed a bit of noise to said convolution
    */



    return {
        currentAnalysis,
        analyze,
        buildMultSample,
    };
});