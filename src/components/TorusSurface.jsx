import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * 3D surface mesh for the compactified GFF on a torus.
 *
 * The fundamental domain of C/(Z + τZ) is a parallelogram with corners
 * (0,0), (1,0), (τ₁,τ₂), (1+τ₁,τ₂) in (x,y) coordinates.
 * We center it at the origin and set the surface height to φ · heightScale.
 *
 * Vertex colors use a cyclic HSL colormap based on φ mod 2πr,
 * visualizing the S¹ target of the compact boson.
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
    const Np = N + 1;
    const positions = new Float32Array(Np * Np * 3);
    const colors = new Float32Array(Np * Np * 3);
    const indices = [];
    const twopiR = 2 * Math.PI * r;

    // Center of parallelogram
    const cx = (1 + tau1) / 2;
    const cz = tau2 / 2;

    const color = new THREE.Color();

    for (let j1 = 0; j1 <= N; j1++) {
      for (let j2 = 0; j2 <= N; j2++) {
        const alpha = j1 / N;
        const beta = j2 / N;

        // Map (α,β) to parallelogram in (x,z) plane, centered at origin
        const x = alpha + beta * tau1 - cx;
        const z = beta * tau2 - cz;

        // Scalar GFF (periodic on the torus)
        const phi_s = field[(j1 % N) * N + (j2 % N)];

        // Harmonic/winding part: φ_h(α,β) = 2πr(mα + nβ)
        const phi_h = showWinding ? twopiR * (m * alpha + n * beta) : 0;
        const phi = phi_s + phi_h;

        // Centered mod: map to [-πr, πr) so large r is identity
        const displayPhi =
          modHeight && twopiR > 1e-10
            ? phi - twopiR * Math.round(phi / twopiR)
            : phi;

        const idx = j1 * Np + j2;
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = displayPhi * heightScale;
        positions[idx * 3 + 2] = z;

        // Cyclic color: hue = (φ mod 2πr) / 2πr
        const t =
          twopiR > 1e-10
            ? (((phi % twopiR) + twopiR) % twopiR) / twopiR
            : 0.5;
        color.setHSL(t * 0.85, 0.75, 0.55); // scale hue to avoid red-red wrap
        colors[idx * 3] = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;
      }
    }

    // Two triangles per grid cell
    for (let j1 = 0; j1 < N; j1++) {
      for (let j2 = 0; j2 < N; j2++) {
        const a = j1 * Np + j2;
        const b = a + 1;
        const c = (j1 + 1) * Np + j2;
        const d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [field, N, tau1, tau2, r, m, n, heightScale, showWinding, modHeight]);

  // Shared material (created once)
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

  // Compute copy offsets for tiling
  const offsets = useMemo(() => {
    const result = [];
    const aRange = tileAlpha ? copies : 0;
    const bRange = tileBeta ? copies : 0;
    const phiRange = stackPhi && modHeight ? copies : 0;
    const twopiR = 2 * Math.PI * r;

    for (let ia = -aRange; ia <= aRange; ia++) {
      for (let ib = -bRange; ib <= bRange; ib++) {
        for (let ip = -phiRange; ip <= phiRange; ip++) {
          // α-period is (1, 0) in (x, z); β-period is (τ₁, τ₂); φ-period is 2πr·heightScale in y
          const dx = ia + ib * tau1;
          const dy = ip * twopiR * heightScale;
          const dz = ib * tau2;
          result.push([dx, dy, dz]);
        }
      }
    }
    return result;
  }, [tileAlpha, tileBeta, stackPhi, modHeight, copies, r, tau1, tau2, heightScale]);

  return (
    <group>
      {offsets.map((pos, i) => (
        <mesh key={i} geometry={geometry} material={material} position={pos} />
      ))}
    </group>
  );
}
