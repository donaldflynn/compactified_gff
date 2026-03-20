import { fft2d } from './fft';

/**
 * Mulberry32 PRNG — deterministic, seedable, good statistical properties.
 */
function createRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform using a given PRNG.
 */
function randnFromRNG(rng) {
  let u, v, s;
  do {
    u = 2 * rng() - 1;
    v = 2 * rng() - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  return u * Math.sqrt(-2 * Math.log(s) / s);
}

/**
 * Pre-generate all random coefficients for a given seed and grid size.
 * This allows smooth deformation when torus parameters change —
 * the same random numbers are reused with different eigenvalues.
 *
 * @param {number} N - grid size (power of 2)
 * @param {number} seed - integer seed
 * @returns {{ z: Float64Array, u: number }}
 *   z: N*N*2 Gaussian random numbers (re,im pairs for each Fourier mode)
 *   u: uniform random in [0,1) for winding sector selection
 */
export function generateRandomCoeffs(N, seed) {
  const rng = createRNG(seed + 1); // +1 to avoid seed=0 degeneracy
  const z = new Float64Array(N * N * 2);
  for (let i = 0; i < N * N * 2; i++) {
    z[i] = randnFromRNG(rng);
  }
  const u = rng();
  return { z, u };
}

/**
 * Compute the scalar GFF on an N×N torus grid using precomputed random coefficients.
 *
 * Torus: C/(Z + τZ) with τ = τ₁ + iτ₂.
 * Action: S[φ] = (g₀/4π) ∫ |∇φ|² dA
 *
 * The covariance is: ⟨φ(z)φ(w)⟩ = (2π/g₀) G(z,w)
 * where G is the Green's function of -Δ on the torus.
 *
 * In Fourier space, eigenvalues of -Δ are:
 *   λ_{k₁,k₂} = (4π²/τ₂²)|k₁τ - k₂|²
 *
 * We sample: φ = Re(IFFT(C)) where
 *   C_k = N² √(2π/(g₀ τ₂ λ_k)) · (Z₁ + iZ₂)
 * The N² compensates for IFFT's 1/N² normalization.
 *
 * @param {number} N - grid size
 * @param {number} tau1 - Re(τ)
 * @param {number} tau2 - Im(τ) > 0
 * @param {number} g0 - coupling constant
 * @param {Float64Array} z - precomputed Gaussian random numbers (length N*N*2)
 * @returns {Float64Array} field values on N×N grid (row-major, indexed by (α,β))
 */
export function computeGFF(N, tau1, tau2, g0, z) {
  const re = new Float64Array(N * N);
  const im = new Float64Array(N * N);

  for (let k1 = 0; k1 < N; k1++) {
    for (let k2 = 0; k2 < N; k2++) {
      const f1 = k1 <= N / 2 ? k1 : k1 - N;
      const f2 = k2 <= N / 2 ? k2 : k2 - N;
      if (f1 === 0 && f2 === 0) continue;

      // |f₁τ - f₂|² = (f₁τ₁ - f₂)² + (f₁τ₂)²
      const dRe = f1 * tau1 - f2;
      const dIm = f1 * tau2;
      const lambda = (4 * Math.PI * Math.PI * (dRe * dRe + dIm * dIm)) / (tau2 * tau2);

      // C_k = N² · σ · (Z₁ + iZ₂) where σ = √(2π/(g₀ τ₂ λ))
      const sigma = N * N * Math.sqrt((2 * Math.PI) / (g0 * tau2 * lambda));

      const idx = k1 * N + k2;
      re[idx] = sigma * z[idx * 2];
      im[idx] = sigma * z[idx * 2 + 1];
    }
  }

  // Inverse FFT (includes 1/N² normalization)
  const result = fft2d(re, im, N, 1);

  // Return real part — this is the sampled GFF
  return result.re;
}

/**
 * Select winding numbers (m,n) from the Boltzmann distribution using
 * a precomputed uniform random number.
 *
 * Weight: exp(-π g₀ r² |mτ - n|² / τ₂)
 *
 * This comes from the Hodge norm of the harmonic 1-form ω_{m,n}:
 *   ∫_Σ ω_{m,n} ∧ *ω_{m,n} = (2πr)² |mτ - n|² / τ₂
 *
 * @param {number} tau1 - Re(τ)
 * @param {number} tau2 - Im(τ)
 * @param {number} r - compactification radius
 * @param {number} g0 - coupling constant
 * @param {number} u - precomputed uniform random in [0,1)
 * @param {number} K - cutoff for winding number search (default 10)
 * @returns {[number, number]} winding numbers [m, n]
 */
export function selectWindingSector(tau1, tau2, r, g0, u, K = 10) {
  const weights = [];
  const pairs = [];

  for (let m = -K; m <= K; m++) {
    for (let n = -K; n <= K; n++) {
      const dRe = m * tau1 - n;
      const dIm = m * tau2;
      const absSq = dRe * dRe + dIm * dIm;
      const w = Math.exp((-Math.PI * g0 * r * r * absSq) / tau2);
      weights.push(w);
      pairs.push([m, n]);
    }
  }

  const total = weights.reduce((a, b) => a + b, 0);
  let thresh = u * total;
  for (let i = 0; i < weights.length; i++) {
    thresh -= weights[i];
    if (thresh <= 0) return pairs[i];
  }
  return pairs[pairs.length - 1];
}
