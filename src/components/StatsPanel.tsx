import { TreeStats } from '../lib/bplustree'
import './StatsPanel.css'

interface StatsPanelProps {
  stats: TreeStats
  nodeDistribution: Map<number, number>
  generationTime?: number
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function StatsPanel({ stats, nodeDistribution, generationTime }: StatsPanelProps) {
  return (
    <div className="stats-panel">
      <div className="panel-header">
        <span className="panel-icon">📈</span>
        <h2>Statistics</h2>
      </div>

      {generationTime !== undefined && (
        <div className="generation-time">
          <span className="time-icon">⏱️</span>
          <span className="time-label">Generated in</span>
          <span className="time-value">{formatTime(generationTime)}</span>
        </div>
      )}

      <div className="stats-section">
        <h3 className="section-title">B+ Tree</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{stats.height}</span>
            <span className="stat-label">Height</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.totalNodes.toLocaleString()}</span>
            <span className="stat-label">Total Nodes</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.leafNodes.toLocaleString()}</span>
            <span className="stat-label">Leaf Nodes</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.internalNodes.toLocaleString()}</span>
            <span className="stat-label">Internal</span>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <h3 className="section-title">Keys Distribution</h3>
        <div className="stats-list">
          <div className="stat-row">
            <span className="stat-key">Total Keys</span>
            <span className="stat-val highlight">{stats.totalKeys.toLocaleString()}</span>
          </div>
          <div className="stat-row">
            <span className="stat-key">Min Keys/Leaf</span>
            <span className="stat-val">{stats.minKeysPerLeaf}</span>
          </div>
          <div className="stat-row">
            <span className="stat-key">Max Keys/Leaf</span>
            <span className="stat-val">{stats.maxKeysPerLeaf}</span>
          </div>
          <div className="stat-row">
            <span className="stat-key">Avg Keys/Leaf</span>
            <span className="stat-val">{stats.avgKeysPerLeaf.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <h3 className="section-title">Snowflake Nodes</h3>
        <div className="node-distribution">
          {Array.from(nodeDistribution.entries())
            .sort((a, b) => a[0] - b[0])
            .slice(0, 10)
            .map(([nodeId, count]) => (
              <div key={nodeId} className="node-bar-container">
                <div className="node-bar-label">
                  <span className="node-id">Node {nodeId}</span>
                  <span className="node-count">{count.toLocaleString()}</span>
                </div>
                <div className="node-bar-track">
                  <div
                    className="node-bar-fill"
                    style={{
                      width: `${(count / Math.max(...nodeDistribution.values())) * 100}%`,
                      backgroundColor: `hsl(${(nodeId * 137.5) % 360}, 70%, 55%)`,
                    }}
                  />
                </div>
              </div>
            ))}
          {nodeDistribution.size > 10 && (
            <div className="more-nodes">
              +{nodeDistribution.size - 10} more nodes
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
