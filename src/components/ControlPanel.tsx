import { IdType } from '../lib/parallelGenerator'
import './ControlPanel.css'

interface ControlPanelProps {
  nodeCount: number
  idsPerNode: number
  treeOrder: number
  idType: IdType
  onNodeCountChange: (value: number) => void
  onIdsPerNodeChange: (value: number) => void
  onTreeOrderChange: (value: number) => void
  onIdTypeChange: (value: IdType) => void
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
  idType,
  onNodeCountChange,
  onIdsPerNodeChange,
  onTreeOrderChange,
  onIdTypeChange,
  onGenerate,
  onClear,
  isGenerating,
  hasData,
  progress,
}: ControlPanelProps) {
  const nodeLabel = idType === 'snowflake' ? 'Nodes' : 'Devices'
  const maxNodes = idType === 'snowflake' ? 1024 : 1024

  return (
    <div className="control-panel">
      <div className="panel-header">
        <span className="panel-icon">⚙️</span>
        <h2>Configuration</h2>
      </div>

      {/* ID Type Selector */}
      <div className="control-group">
        <label className="control-label">
          <span className="label-text">ID Type</span>
          <span className="label-hint">Choose the ID generation algorithm</span>
        </label>
        <div className="id-type-selector">
          <button
            className={`id-type-btn ${idType === 'snowflake' ? 'active' : ''}`}
            onClick={() => onIdTypeChange('snowflake')}
            disabled={isGenerating}
          >
            <span className="id-type-icon">❄️</span>
            <span className="id-type-name">Snowflake</span>
            <span className="id-type-bits">64-bit</span>
          </button>
          <button
            className={`id-type-btn ${idType === 'uuidv7' ? 'active' : ''}`}
            onClick={() => onIdTypeChange('uuidv7')}
            disabled={isGenerating}
          >
            <span className="id-type-icon">🆔</span>
            <span className="id-type-name">UUIDv7</span>
            <span className="id-type-bits">128-bit</span>
          </button>
        </div>
      </div>

      <div className="control-group">
        <label className="control-label">
          <span className="label-text">Unique {nodeLabel}</span>
          <span className="label-hint">
            {idType === 'snowflake' 
              ? 'Number of machines generating IDs'
              : 'Number of devices generating UUIDs'
            }
          </span>
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
            onChange={(e) => onNodeCountChange(Math.max(1, Math.min(maxNodes, parseInt(e.target.value) || 1)))}
            min={1}
            max={maxNodes}
            disabled={isGenerating}
          />
          <button
            className="stepper-btn"
            onClick={() => onNodeCountChange(Math.min(maxNodes, nodeCount + 1))}
            disabled={nodeCount >= maxNodes || isGenerating}
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
          <span className="label-text">IDs per {idType === 'snowflake' ? 'Node' : 'Device'}</span>
          <span className="label-hint">Number of IDs generated per {idType === 'snowflake' ? 'node' : 'device'}</span>
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
