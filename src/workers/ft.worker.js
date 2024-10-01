// @ts-check
'use strict';

const objectRequireProperties = (obj, properties) => {
  properties.forEach(prop => {
    if (!obj.hasOwnProperty(prop)) {
      throw new Error(`Missing property: ${prop}`)
    }
  })
}
/**
 * @typedef {Float32Array | number[]} EitherNumArray 
/**
 * @typedef {Object} ImagAndReal
 * @property {EitherNumArray} real
 * @property {EitherNumArray} imag
 */
/**
 * @typedef {Object} FTRequest
 * @property {'ft' | 'ifft'} operation
 * @property {string} id
 * @property {EitherNumArray | ImagAndReal} data
 */

self.addEventListener('message', function (event) {
  // let parsed;
  // try{
  //   parsed = JSON.parse(event.data)
  // } catch (e) {
  //   console.error("worker: failed to parse request", event.data)
  //   self.postMessage(JSON.stringify({
  //     id: null,
  //     err: e
  //   }))
  //   return
  // }
  /** @type {FTRequest} */
  const request = event.data;
  console.log('worker: request', request)

  try {
    objectRequireProperties(request, ['id', 'data', 'operation'])
  } catch (e) {
    console.error("worker: failed to parse request", request)
    self.postMessage({
      id: request.id,
      err: e
    })
    return
  }

  let err;
  let result;

  switch (request.operation) {
    case 'ft':
      try {
        result = fft(request.data)
      } catch (e) {
        err = e
      }

      break;
    case 'ifft':
      try {
        result = ifft(request.data)
      } catch (e) {
        err = e
      }
      break;
    default:
      err = new Error(`Unknown operation: ${request.operation}`)
      break;
  }

  const response = {
    ...request,
    result,
    err
  }

  console.log('worker: success', request)
  // send the response back
  self.postMessage(response)
}, false)



/// https://github.com/nevosegal/fftjs/blob/master/src/fft.js
/***

MIT License

Copyright (c) 2017 Nevo Segal

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/


// real to complex fft
let fft = function (signal) {

  let complexSignal = {};

  if (signal.real === undefined || signal.imag === undefined) {
    complexSignal = utils.constructComplexArray(signal);
  }
  else {
    complexSignal.real = signal.real.slice();
    complexSignal.imag = signal.imag.slice();
  }

  const N = complexSignal.real.length;
  const logN = Math.log2(N);

  if (Math.round(logN) != logN) throw new Error('Input size must be a power of 2.');

  if (complexSignal.real.length != complexSignal.imag.length) {
    throw new Error('Real and imaginary components must have the same length.');
  }

  const bitReversedIndices = utils.bitReverseArray(N);

  // sort array
  let ordered = {
    'real': [],
    'imag': []
  };

  for (let i = 0; i < N; i++) {
    ordered.real[bitReversedIndices[i]] = complexSignal.real[i];
    ordered.imag[bitReversedIndices[i]] = complexSignal.imag[i];
  }

  for (let i = 0; i < N; i++) {
    complexSignal.real[i] = ordered.real[i];
    complexSignal.imag[i] = ordered.imag[i];
  }
  // iterate over the number of stages
  for (let n = 1; n <= logN; n++) {
    let currN = Math.pow(2, n);

    // find twiddle factors
    for (let k = 0; k < currN / 2; k++) {
      let twiddle = utils.euler(k, currN);

      // on each block of FT, implement the butterfly diagram
      for (let m = 0; m < N / currN; m++) {
        let currEvenIndex = (currN * m) + k;
        let currOddIndex = (currN * m) + k + (currN / 2);

        let currEvenIndexSample = {
          'real': complexSignal.real[currEvenIndex],
          'imag': complexSignal.imag[currEvenIndex]
        }
        let currOddIndexSample = {
          'real': complexSignal.real[currOddIndex],
          'imag': complexSignal.imag[currOddIndex]
        }

        let odd = utils.multiply(twiddle, currOddIndexSample);

        let subtractionResult = utils.subtract(currEvenIndexSample, odd);
        complexSignal.real[currOddIndex] = subtractionResult.real;
        complexSignal.imag[currOddIndex] = subtractionResult.imag;

        let additionResult = utils.add(odd, currEvenIndexSample);
        complexSignal.real[currEvenIndex] = additionResult.real;
        complexSignal.imag[currEvenIndex] = additionResult.imag;
      }
    }
  }

  return complexSignal;
}

// complex to real ifft
let ifft = function (signal) {

  if (signal.real === undefined || signal.imag === undefined) {
    throw new Error("IFFT only accepts a complex input.")
  }

  const N = signal.real.length;

  var complexSignal = {
    'real': [],
    'imag': []
  };

  //take complex conjugate in order to be able to use the regular FFT for IFFT
  for (let i = 0; i < N; i++) {
    let currentSample = {
      'real': signal.real[i],
      'imag': signal.imag[i]
    };

    let conjugateSample = utils.conj(currentSample);
    complexSignal.real[i] = conjugateSample.real;
    complexSignal.imag[i] = conjugateSample.imag;
  }

  //compute
  let X = fft(complexSignal);

  //normalize
  complexSignal.real = X.real.map((val) => {
    return val / N;
  });

  complexSignal.imag = X.imag.map((val) => {
    return val / N;
  });

  return complexSignal;
}



// memoization of the reversal of different lengths.
var memoizedReversal = {};
var memoizedZeroBuffers = {}

let constructComplexArray = function (signal) {
  var complexSignal = {};

  complexSignal.real = (signal.real === undefined) ? signal.slice() : signal.real.slice();

  var bufferSize = complexSignal.real.length;

  if (memoizedZeroBuffers[bufferSize] === undefined) {
    memoizedZeroBuffers[bufferSize] = Array.apply(null, Array(bufferSize)).map(Number.prototype.valueOf, 0);
  }

  complexSignal.imag = memoizedZeroBuffers[bufferSize].slice();

  return complexSignal;
}
let bitReverseArray = function (N) {
  if (memoizedReversal[N] === undefined) {
    let maxBinaryLength = (N - 1).toString(2).length; //get the binary length of the largest index.
    let templateBinary = '0'.repeat(maxBinaryLength); //create a template binary of that length.
    let reversed = {};
    for (let n = 0; n < N; n++) {
      let currBinary = n.toString(2); //get binary value of current index.

      //prepend zeros from template to current binary. This makes binary values of all indices have the same length.
      currBinary = templateBinary.substr(currBinary.length) + currBinary;

      currBinary = [...currBinary].reverse().join(''); //reverse
      reversed[n] = parseInt(currBinary, 2); //convert to decimal
    }
    memoizedReversal[N] = reversed; //save
  }
  return memoizedReversal[N];
}

// complex multiplication
let multiply = function (a, b) {
  return {
    'real': a.real * b.real - a.imag * b.imag,
    'imag': a.real * b.imag + a.imag * b.real
  };
}

// complex addition
let add = function (a, b) {
  return {
    'real': a.real + b.real,
    'imag': a.imag + b.imag
  };
}

// complex subtraction
let subtract = function (a, b) {
  return {
    'real': a.real - b.real,
    'imag': a.imag - b.imag
  };
}

// euler's identity e^x = cos(x) + sin(x)
let euler = function (kn, N) {
  let x = -2 * Math.PI * kn / N;
  return { 'real': Math.cos(x), 'imag': Math.sin(x) };
}

// complex conjugate
let conj = function (a) {
  a.imag *= -1;
  return a;
}

const utils = {
  bitReverseArray,
  multiply,
  add,
  subtract,
  euler,
  conj,
  constructComplexArray
};
