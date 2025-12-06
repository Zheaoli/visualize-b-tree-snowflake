import './ControlPanel.css'

interface ControlPanelProps {
  nodeCount: number
  idsPerNode: number
  treeOrder: number
  onNodeCountChange: (value: number) => void
  onIdsPerNodeChange: (value: number) => void
  onTreeOrderChange: (value: number) => void
  onGenerate: () => void
  onClear: () => void
  isGenerating: boolean
  hasData: boolean
  progress?: { phase: string; percent: number }
}

export function ControlPanel({
  nodeCount,
  idsPerNode,
  treeOrder,
  onNodeCountChange,
  onIdsPerNodeChange,
  onTreeOrderChange,
  onGenerate,
  onClear,
  isGenerating,
  hasData,
  progress,
}: ControlPanelProps) {
  return (
    <div className="control-panel">
      <div className="panel-header">
        <span className="panel-icon">⚙️</span>
        <h2>Configuration</h2>
      </div>

      <div className="control-group">
        <label className="control-label">
          <span className="label-text">Unique Nodes</span>
          <span className="label-hint">Number of machines generating IDs</span>
        </label>
        <div className="input-with-controls">
          <button
            className="stepper-btn"
            onClick={() => onNodeCountChange(Math.max(1, nodeCount - 1))}
            disabled={nodeCount <= 1 || isGenerating}
          >
            −
          </button>
          <input
            type="number"
            value={nodeCount}
            onChange={(e) => onNodeCountChange(Math.max(1, Math.min(1024, parseInt(e.target.value) || 1)))}
            min={1}
            max={1024}
            disabled={isGenerating}
          />
          <button
            className="stepper-btn"
            onClick={() => onNodeCountChange(Math.min(1024, nodeCount + 1))}
            disabled={nodeCount >= 1024 || isGenerating}
          >
            +
          </button>
        </div>
        <div className="control-range">
          <input
            type="range"
            value={nodeCount}
            onChange={(e) => onNodeCountChange(parseInt(e.target.value))}
            min={1}
            max={50}
            disabled={isGenerating}
          />
          <span className="range-value">{nodeCount}</span>
        </div>
      </div>

      <div className="control-group">
        <label className="control-label">
          <span className="label-text">IDs per Node</span>
          <span className="label-hint">Average IDs generated per node</span>
        </label>
        <div className="input-with-controls">
          <button
            className="stepper-btn"
            onClick={() => onIdsPerNodeChange(Math.max(1, idsPerNode - 10))}
            disabled={idsPerNode <= 1 || isGenerating}
          >
            −
          </button>
          <input
            type="number"
            value={idsPerNode}
            onChange={(e) => onIdsPerNodeChange(Math.max(1, Math.min(100000, parseInt(e.target.value) || 1)))}
            min={1}
            max={100000}
            disabled={isGenerating}
          />
          <button
            className="stepper-btn"
            onClick={() => onIdsPerNodeChange(Math.min(100000, idsPerNode + 10))}
            disabled={idsPerNode >= 100000 || isGenerating}
          >
            +
          </button>
        </div>
        <div className="control-range">
          <input
            type="range"
            value={Math.min(idsPerNode, 5000)}
            onChange={(e) => onIdsPerNodeChange(parseInt(e.target.value))}
            min={1}
            max={5000}
            disabled={isGenerating}
          />
          <span className="range-value">{idsPerNode.toLocaleString()}</span>
        </div>
      </div>

      <div className="control-group">
        <label className="control-label">
          <span className="label-text">B+ Tree Order</span>
          <span className="label-hint">Max children per node (3-32)</span>
        </label>
        <div className="input-with-controls">
          <button
            className="stepper-btn"
            onClick={() => onTreeOrderChange(Math.max(3, treeOrder - 1))}
            disabled={treeOrder <= 3 || isGenerating}
          >
            −
          </button>
          <input
            type="number"
            value={treeOrder}
            onChange={(e) => onTreeOrderChange(Math.max(3, Math.min(32, parseInt(e.target.value) || 3)))}
            min={3}
            max={32}
            disabled={isGenerating}
          />
          <button
            className="stepper-btn"
            onClick={() => onTreeOrderChange(Math.min(32, treeOrder + 1))}
            disabled={treeOrder >= 32 || isGenerating}
          >
            +
          </button>
        </div>
        <div className="control-range">
          <input
            type="range"
            value={treeOrder}
            onChange={(e) => onTreeOrderChange(parseInt(e.target.value))}
            min={3}
            max={32}
            disabled={isGenerating}
          />
          <span className="range-value">{treeOrder}</span>
        </div>
      </div>

      <div className="total-preview">
        <span className="preview-label">Total IDs:</span>
        <span className="preview-value">{(nodeCount * idsPerNode).toLocaleString()}</span>
      </div>

      {isGenerating && progress && (
        <div className="progress-container">
          <div className="progress-text">{progress.phase}</div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="progress-percent">{progress.percent}%</div>
        </div>
      )}

      <div className="button-group">
        <button
          className="generate-btn"
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span className="spinner" />
              Generating...
            </>
          ) : (
            <>
              <span className="btn-icon">⚡</span>
              Generate
            </>
          )}
        </button>
        
        {hasData && !isGenerating && (
          <button className="clear-btn" onClick={onClear}>
            <span className="btn-icon">🗑️</span>
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
