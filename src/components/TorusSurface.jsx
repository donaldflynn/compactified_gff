import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * 3D surface mesh for the compactified GFF on a torus.
 *
 * Three rendering modes:
 * 1. Raw height (modHeight off): smooth surface, height = φ
 * 2. Modded height (modHeight on, stackPhi off): height = φ mod 2πr (centered),
 *    with wrapping-edge triangles removed to avoid cliff artifacts
 * 3. Stacked (modHeight on, stackPhi on): builds a single connected geometry
 *    across multiple stack levels, with triangles at wrapping edges connecting
 *    to the correct adjacent level — giving a continuous multi-sheeted surface
 */
export default function TorusSurface({
  field,
  N,
  tau1,
  tau2,
  r,
  m,
  n,
  heightScale,
  showWinding,
  modHeight,
  stackPhi,
  tileAlpha,
  tileBeta,
  copies,
}) {
  const geometry = useMemo(() => {
    const twopiR = 2 * Math.PI * r;
    const piR = Math.PI * r;
    const Np = N + 1;
    const cx = (1 + tau1) / 2;
    const cz = tau2 / 2;
    const color = new THREE.Color();

    const usemod = modHeight && twopiR > 1e-10;
    const doStack = stackPhi && usemod;

    // --- Pass 1: compute raw φ, modded φ, and period for each grid point ---
    const rawPhis = new Float32Array(Np * Np);
    const moddedPhis = new Float32Array(Np * Np);
    const periods = new Int32Array(Np * Np);

    for (let j1 = 0; j1 <= N; j1++) {
      for (let j2 = 0; j2 <= N; j2++) {
        const alpha = j1 / N;
        const beta = j2 / N;
        const phi_s = field[(j1 % N) * N + (j2 % N)];
        const phi_h = showWinding ? twopiR * (m * alpha + n * beta) : 0;
        const phi = phi_s + phi_h;
        const idx = j1 * Np + j2;
        rawPhis[idx] = phi;
        if (usemod) {
          const p = Math.round(phi / twopiR);
          periods[idx] = p;
          moddedPhis[idx] = phi - p * twopiR;
        } else {
          moddedPhis[idx] = phi;
        }
      }
    }

    // --- Determine how many vertex levels we need ---
    // nCopies = number of visible stack levels on each side (from user slider)
    // We generate extra levels beyond nCopies so that partial surfaces
    // entering the visible range from above/below are included.
    // pMax = max period deviation across all vertices
    // nExtra = pMax + 1 extra levels on each side for partial surface visibility
    // nInternal = total vertex levels needed to support all triangle references
    //
    // SAFETY: cap total levels to prevent OOM when r is very small
    // (which makes pMax huge as periods = round(φ/2πr) diverge).
    const MAX_LEVELS = 15; // at most 15 vertex levels (≈ 15 × 65² = 63K verts for N=64)
    const nCopies = doStack ? copies : 0;
    let nInternal = 0;
    let nLevelMin = 0, nLevelMax = 0;
    if (doStack) {
      let minP = 0, maxP = 0;
      for (let i = 0; i < Np * Np; i++) {
        if (periods[i] < minP) minP = periods[i];
        if (periods[i] > maxP) maxP = periods[i];
      }
      const pMax = Math.max(-minP, maxP, 0);
      const nExtra = Math.min(pMax + 1, 3); // cap extra padding
      nLevelMin = -(nCopies + nExtra);
      nLevelMax = nCopies + nExtra;
      nInternal = nCopies + pMax + nExtra;
      // Cap nInternal so total vertex levels stay bounded
      const maxHalf = Math.floor((MAX_LEVELS - 1) / 2);
      if (nInternal > maxHalf) nInternal = maxHalf;
      // Also clamp level iteration range to what vertices support
      nLevelMin = Math.max(nLevelMin, -nInternal);
      nLevelMax = Math.min(nLevelMax, nInternal);
    }
    const numLevels = 2 * nInternal + 1;

    // --- Pass 2: create vertices for each level ---
    const totalVerts = numLevels * Np * Np;
    const positions = new Float32Array(totalVerts * 3);
    const colors = new Float32Array(totalVerts * 3);

    for (let cl = -nInternal; cl <= nInternal; cl++) {
      const levelOff = (cl + nInternal) * Np * Np;
      for (let j1 = 0; j1 <= N; j1++) {
        for (let j2 = 0; j2 <= N; j2++) {
          const alpha = j1 / N;
          const beta = j2 / N;
          const baseIdx = j1 * Np + j2;
          const vertIdx = levelOff + baseIdx;

          const x = alpha + beta * tau1 - cx;
          const z = beta * tau2 - cz;
          const h = (moddedPhis[baseIdx] + cl * twopiR) * heightScale;

          positions[vertIdx * 3] = x;
          positions[vertIdx * 3 + 1] = h;
          positions[vertIdx * 3 + 2] = z;

          // Cyclic color based on raw φ (identical across all copies)
          const phi = rawPhis[baseIdx];
          const t =
            twopiR > 1e-10
              ? (((phi % twopiR) + twopiR) % twopiR) / twopiR
              : 0.5;
          color.setHSL(t * 0.85, 0.75, 0.55);
          colors[vertIdx * 3] = color.r;
          colors[vertIdx * 3 + 1] = color.g;
          colors[vertIdx * 3 + 2] = color.b;
        }
      }
    }

    // --- Pass 3: build triangle indices ---
    const indices = [];

    if (doStack) {
      // Stacking mode: for each visible level, create triangles whose vertices
      // reference the correct copy level (level + p_v) so that cross-wrap
      // edges connect smoothly between stack levels.
      // Height at vertex v for base level `level` is:
      //   (m_v + (level + p_v) * 2πr) * h = (φ_raw_v + level * 2πr) * h
      // which is the raw surface shifted by level * 2πr — always smooth.
      const stride = Np * Np;
      for (let level = nLevelMin; level <= nLevelMax; level++) {
        for (let j1 = 0; j1 < N; j1++) {
          for (let j2 = 0; j2 < N; j2++) {
            const a = j1 * Np + j2;
            const b = a + 1;
            const c = (j1 + 1) * Np + j2;
            const d = c + 1;

            const cla = level + periods[a];
            const clb = level + periods[b];
            const clc = level + periods[c];
            const cld = level + periods[d];

            // Triangle 1: a, b, c
            if (
              cla >= -nInternal && cla <= nInternal &&
              clb >= -nInternal && clb <= nInternal &&
              clc >= -nInternal && clc <= nInternal
            ) {
              indices.push(
                (cla + nInternal) * stride + a,
                (clb + nInternal) * stride + b,
                (clc + nInternal) * stride + c
              );
            }

            // Triangle 2: b, d, c
            if (
              clb >= -nInternal && clb <= nInternal &&
              cld >= -nInternal && cld <= nInternal &&
              clc >= -nInternal && clc <= nInternal
            ) {
              indices.push(
                (clb + nInternal) * stride + b,
                (cld + nInternal) * stride + d,
                (clc + nInternal) * stride + c
              );
            }
          }
        }
      }
    } else {
      // Single level — skip cliff triangles when mod is active
      for (let j1 = 0; j1 < N; j1++) {
        for (let j2 = 0; j2 < N; j2++) {
          const a = j1 * Np + j2;
          const b = a + 1;
          const c = (j1 + 1) * Np + j2;
          const d = c + 1;

          if (usemod) {
            const ha = moddedPhis[a], hb = moddedPhis[b];
            const hc = moddedPhis[c], hd = moddedPhis[d];
            if (Math.abs(ha - hb) < piR && Math.abs(ha - hc) < piR && Math.abs(hb - hc) < piR) {
              indices.push(a, b, c);
            }
            if (Math.abs(hb - hd) < piR && Math.abs(hb - hc) < piR && Math.abs(hd - hc) < piR) {
              indices.push(b, d, c);
            }
          } else {
            indices.push(a, b, c, b, d, c);
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [field, N, tau1, tau2, r, m, n, heightScale, showWinding, modHeight, stackPhi, copies]);

  // Shared material
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.6,
        metalness: 0.1,
      }),
    []
  );

  // Horizontal tiling only (vertical stacking is built into the geometry)
  const offsets = useMemo(() => {
    const result = [];
    const aRange = tileAlpha ? copies : 0;
    const bRange = tileBeta ? copies : 0;
    for (let ia = -aRange; ia <= aRange; ia++) {
      for (let ib = -bRange; ib <= bRange; ib++) {
        result.push([ia + ib * tau1, 0, ib * tau2]);
      }
    }
    return result;
  }, [tileAlpha, tileBeta, copies, tau1, tau2]);

  return (
    <group>
      {offsets.map((pos, i) => (
        <mesh key={i} geometry={geometry} material={material} position={pos} />
      ))}
    </group>
  );
}
