import type { LayerHeightRange, PrintSettings } from '../types/slicer';

interface ParameterPanelProps {
  settings: PrintSettings;
  onSettingsChange: (settings: PrintSettings) => void;
  layerHeightRanges: LayerHeightRange[];
  onRangesChange: (ranges: LayerHeightRange[]) => void;
}

function newRangeId(): string {
  return `range-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ParameterPanel({
  settings,
  onSettingsChange,
  layerHeightRanges,
  onRangesChange,
}: ParameterPanelProps) {
  const update = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const addRange = () => {
    onRangesChange([
      ...layerHeightRanges,
      { id: newRangeId(), zMin: 0, zMax: 10, expression: '0.1' },
    ]);
  };

  const updateRange = (id: string, patch: Partial<LayerHeightRange>) => {
    onRangesChange(
      layerHeightRanges.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  };

  const removeRange = (id: string) => {
    onRangesChange(layerHeightRanges.filter((r) => r.id !== id));
  };

  return (
    <section className="panel">
      <h2>Print parameters</h2>

      <div className="field-grid">
        <label>
          Layer height (mm)
          <input
            type="number"
            min={0.05}
            max={0.5}
            step={0.05}
            value={settings.layerHeight}
            onChange={(e) => update('layerHeight', Number(e.target.value))}
          />
        </label>

        <label>
          Nozzle temp (°C)
          <input
            type="number"
            min={150}
            max={300}
            step={5}
            value={settings.printTemperature}
            onChange={(e) => update('printTemperature', Number(e.target.value))}
          />
        </label>

        <label>
          Bed temp (°C)
          <input
            type="number"
            min={0}
            max={120}
            step={5}
            value={settings.bedTemperature}
            onChange={(e) => update('bedTemperature', Number(e.target.value))}
          />
        </label>

        <label>
          Pause at Z (mm)
          <input
            type="number"
            min={0}
            step={0.1}
            value={settings.pauseAtZ}
            onChange={(e) => update('pauseAtZ', Number(e.target.value))}
          />
          <span className="hint">0 = disabled (no M600)</span>
        </label>

        <label>
          Line width (mm)
          <input
            type="number"
            min={0.2}
            max={1}
            step={0.05}
            value={settings.lineWidth}
            onChange={(e) => update('lineWidth', Number(e.target.value))}
          />
        </label>

        <label>
          Infill density (%)
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={settings.infillDensity}
            onChange={(e) => update('infillDensity', Number(e.target.value))}
          />
          <span className="hint">0 = perimeters only</span>
        </label>
      </div>

      <h3>Dynamic layer height</h3>
      <p className="hint">
        Define Z ranges with a mathjs expression in <code>z</code> (e.g.{' '}
        <code>0.12 + z * 0.002</code>). Ranges must not overlap.
      </p>

      <div className="range-list">
        {layerHeightRanges.map((range) => (
          <div key={range.id} className="range-card">
          <div className="range-card-header">
            <span className="range-card-title">Height range</span>
            <button
              type="button"
              className="btn-remove-range"
              onClick={() => removeRange(range.id)}
            >
              Remove
            </button>
          </div>
          <div className="range-row">
          <label>
            Z min
            <input
              type="number"
              step={0.1}
              value={range.zMin}
              onChange={(e) =>
                updateRange(range.id, { zMin: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Z max
            <input
              type="number"
              step={0.1}
              value={range.zMax}
              onChange={(e) =>
                updateRange(range.id, { zMax: Number(e.target.value) })
              }
            />
          </label>
          <label className="expr-label">
            f(z) → layer height
            <input
              type="text"
              value={range.expression}
              placeholder="0.2"
              onChange={(e) =>
                updateRange(range.id, { expression: e.target.value })
              }
            />
          </label>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="btn-secondary" onClick={addRange}>
        + Add height range
      </button>
    </section>
  );
}
