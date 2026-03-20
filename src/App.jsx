import { useState, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import TorusSurface from './components/TorusSurface';
import Controls from './components/Controls';
import { generateRandomCoeffs, computeGFF, selectWindingSector } from './math/gff';
import './App.css';

export default function App() {
  const [params, setParams] = useState({
    tau1: 0,
    tau2: 1,
    r: 1,
    g0: 1,
    N: 64,
    heightScale: 0.1,
    showWinding: true,
    modHeight: false,
    stackPhi: false,
    tileAlpha: false,
    tileBeta: false,
    copies: 1,
  });
  const [seed, setSeed] = useState(0);
  const [manualWinding, setManualWinding] = useState(false);
  const [windingM, setWindingM] = useState(0);
  const [windingN, setWindingN] = useState(0);

  // Pre-generate random coefficients (only changes on resample or grid size change)
  const randomData = useMemo(
    () => generateRandomCoeffs(params.N, seed),
    [params.N, seed]
  );

  // Compute the GFF and winding sector from current parameters + fixed random data
  // This allows smooth deformation as τ, r, g₀ change
  const { field, sampledM, sampledN } = useMemo(() => {
    const field = computeGFF(
      params.N,
      params.tau1,
      params.tau2,
      params.g0,
      randomData.z
    );
    const [sm, sn] = selectWindingSector(
      params.tau1,
      params.tau2,
      params.r,
      params.g0,
      randomData.u
    );
    return { field, sampledM: sm, sampledN: sn };
  }, [params.tau1, params.tau2, params.r, params.g0, params.N, randomData]);

  const m = manualWinding ? windingM : sampledM;
  const n = manualWinding ? windingN : sampledN;

  const resample = useCallback(() => setSeed((s) => s + 1), []);

  return (
    <div className="app">
      <Controls
        params={params}
        setParams={setParams}
        resample={resample}
        m={m}
        n={n}
        manualWinding={manualWinding}
        setManualWinding={setManualWinding}
        setWindingM={setWindingM}
        setWindingN={setWindingN}
      />
      <div className="canvas-container">
        <Canvas camera={{ position: [1.5, 1.2, 1.5], fov: 50 }}>
          <color attach="background" args={['#1a1a2e']} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 10, 5]} intensity={0.7} />
          <directionalLight position={[-5, 5, -5]} intensity={0.3} />
          <TorusSurface
            field={field}
            N={params.N}
            tau1={params.tau1}
            tau2={params.tau2}
            r={params.r}
            m={m}
            n={n}
            heightScale={params.heightScale}
            showWinding={params.showWinding}
            modHeight={params.modHeight}
            stackPhi={params.stackPhi}
            tileAlpha={params.tileAlpha}
            tileBeta={params.tileBeta}
            copies={params.copies}
          />
          <OrbitControls makeDefault />
          <gridHelper
            args={[2, 10, '#333355', '#222244']}
            position={[0, -0.5, 0]}
          />
        </Canvas>
      </div>
    </div>
  );
}
