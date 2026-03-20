export default function Controls({
  params,
  setParams,
  resample,
  m,
  n,
  manualWinding,
  setManualWinding,
  setWindingM,
  setWindingN,
}) {
  const update = (key, value) => setParams((p) => ({ ...p, [key]: value }));

  return (
    <div className="controls">
      <h2>Compactified GFF on a Torus</h2>
      <p className="subtitle">
        Compact boson on <span className="math">C/(Z + &tau;Z)</span>
      </p>

      <div className="control-group">
        <h3>Torus Modulus &tau; = &tau;&#x2081; + i&tau;&#x2082;</h3>
        <label>
          &tau;&#x2081; = {params.tau1.toFixed(2)}
          <input
            type="range"
            min="-2"
            max="2"
            step="0.01"
            value={params.tau1}
            onChange={(e) => update('tau1', +e.target.value)}
          />
        </label>
        <label>
          &tau;&#x2082; = {params.tau2.toFixed(2)}
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.01"
            value={params.tau2}
            onChange={(e) => update('tau2', +e.target.value)}
          />
        </label>
      </div>

      <div className="control-group">
        <h3>Compactification</h3>
        <label>
          r = {params.r.toFixed(2)}
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.01"
            value={params.r}
            onChange={(e) => update('r', +e.target.value)}
          />
        </label>
        <label>
          g&#x2080; = {params.g0.toFixed(2)}
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.01"
            value={params.g0}
            onChange={(e) => update('g0', +e.target.value)}
          />
        </label>
      </div>

      <div className="control-group">
        <h3>Display</h3>
        <label>
          Height scale = {params.heightScale.toFixed(3)}
          <input
            type="range"
            min="0.005"
            max="0.5"
            step="0.005"
            value={params.heightScale}
            onChange={(e) => update('heightScale', +e.target.value)}
          />
        </label>
        <label>
          Grid:{' '}
          <select
            value={params.N}
            onChange={(e) => update('N', +e.target.value)}
          >
            <option value={32}>32 &times; 32</option>
            <option value={64}>64 &times; 64</option>
            <option value={128}>128 &times; 128</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={params.showWinding}
            onChange={(e) => update('showWinding', e.target.checked)}
          />
          Include winding sector
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={params.modHeight}
            onChange={(e) => update('modHeight', e.target.checked)}
          />
          Height mod 2&pi;r
        </label>
      </div>

      <div className="control-group">
        <h3>Tiling</h3>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={params.stackPhi}
            disabled={!params.modHeight}
            onChange={(e) => update('stackPhi', e.target.checked)}
          />
          Stack &phi; copies (vertical)
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={params.tileAlpha}
            onChange={(e) => update('tileAlpha', e.target.checked)}
          />
          Tile &alpha; direction
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={params.tileBeta}
            onChange={(e) => update('tileBeta', e.target.checked)}
          />
          Tile &beta; direction
        </label>
        {(params.stackPhi || params.tileAlpha || params.tileBeta) && (
          <label>
            Copies per side = {params.copies}
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={params.copies}
              onChange={(e) => update('copies', +e.target.value)}
            />
          </label>
        )}
      </div>

      <div className="control-group">
        <h3>Winding Sector</h3>
        <div className="winding-mode">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={manualWinding}
              onChange={(e) => setManualWinding(e.target.checked)}
            />
            Manual
          </label>
        </div>
        {manualWinding ? (
          <div className="winding-inputs">
            <label>
              m ={' '}
              <input
                type="number"
                value={m}
                onChange={(e) => setWindingM(parseInt(e.target.value) || 0)}
              />
            </label>
            <label>
              n ={' '}
              <input
                type="number"
                value={n}
                onChange={(e) => setWindingN(parseInt(e.target.value) || 0)}
              />
            </label>
          </div>
        ) : (
          <>
            <p className="winding-display">(m, n) = ({m}, {n})</p>
            <button onClick={resample}>Resample</button>
          </>
        )}
      </div>

      <div className="info">
        <p>
          The field is &phi; = &phi;<sub>s</sub> + &phi;<sub>h</sub> where
          &phi;<sub>s</sub> is the scalar GFF and &phi;<sub>h</sub> is the
          harmonic winding part.
        </p>
        <p>
          Colors cycle with &phi; mod 2&pi;r, showing the S&sup1; target.
        </p>
      </div>
    </div>
  );
}
