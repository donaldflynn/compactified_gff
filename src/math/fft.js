/**
 * 1D Cooley-Tukey radix-2 FFT (in-place).
 * @param {Float64Array} re - real parts (length must be power of 2)
 * @param {Float64Array} im - imaginary parts
 * @param {number} sign - -1 for forward DFT, +1 for inverse DFT (no normalization)
 */
export function fft1d(re, im, sign) {
  const N = re.length;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // Butterfly stages
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1;
    const ang = (sign * 2 * Math.PI) / len;
    const wR = Math.cos(ang);
    const wI = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let uR = 1, uI = 0;
      for (let k = 0; k < half; k++) {
        const p = i + k;
        const q = p + half;
        const tR = uR * re[q] - uI * im[q];
        const tI = uR * im[q] + uI * re[q];
        re[q] = re[p] - tR;
        im[q] = im[p] - tI;
        re[p] += tR;
        im[p] += tI;
        const nR = uR * wR - uI * wI;
        uI = uR * wI + uI * wR;
        uR = nR;
      }
    }
  }
}

/**
 * 2D FFT via row-then-column decomposition.
 * Forward (sign=-1): X[k1,k2] = sum x[n1,n2] exp(-2pi i (k1*n1 + k2*n2)/N)
 * Inverse (sign=+1): x[n1,n2] = (1/N^2) sum X[k1,k2] exp(+2pi i (k1*n1 + k2*n2)/N)
 *
 * @param {Float64Array} reIn - input real parts (N*N, row-major)
 * @param {Float64Array} imIn - input imaginary parts
 * @param {number} N - grid size (power of 2)
 * @param {number} sign - -1 forward, +1 inverse
 * @returns {{re: Float64Array, im: Float64Array}}
 */
export function fft2d(reIn, imIn, N, sign) {
  const re = Float64Array.from(reIn);
  const im = Float64Array.from(imIn);
  const tmp = new Float64Array(N);
  const tmi = new Float64Array(N);

  // FFT along rows
  for (let i = 0; i < N; i++) {
    const off = i * N;
    for (let j = 0; j < N; j++) {
      tmp[j] = re[off + j];
      tmi[j] = im[off + j];
    }
    fft1d(tmp, tmi, sign);
    for (let j = 0; j < N; j++) {
      re[off + j] = tmp[j];
      im[off + j] = tmi[j];
    }
  }

  // FFT along columns
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      tmp[i] = re[i * N + j];
      tmi[i] = im[i * N + j];
    }
    fft1d(tmp, tmi, sign);
    for (let i = 0; i < N; i++) {
      re[i * N + j] = tmp[i];
      im[i * N + j] = tmi[i];
    }
  }

  // Normalize for inverse
  if (sign === 1) {
    const inv = 1 / (N * N);
    for (let i = 0; i < N * N; i++) {
      re[i] *= inv;
      im[i] *= inv;
    }
  }

  return { re, im };
}
