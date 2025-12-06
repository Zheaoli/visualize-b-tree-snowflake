import { useMemo, useState } from 'react'
import { BPlusTree } from '../lib/bplustree'
import { SnowflakeGenerator } from '../lib/snowflake'
import './DistributionChart.css'

interface DistributionChartProps {
  ids: { id: bigint; nodeId: number }[]
  tree: BPlusTree<bigint, number>
}

type ViewMode = 'timeline' | 'heatmap' | 'histogram'

export function DistributionChart({ ids, tree }: DistributionChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [selectedNode, setSelectedNode] = useState<number | null>(null)

  // Parse all IDs to extract components
  const parsedIds = useMemo(() => {
    return ids.map(({ id, nodeId }) => ({
      id,
      nodeId,
      components: SnowflakeGenerator.parse(id),
    }))
  }, [ids])

  // Get unique node IDs
  const nodeIds = useMemo(() => {
    return [...new Set(ids.map(i => i.nodeId))].sort((a, b) => a - b)
  }, [ids])

  // Filter by selected node
  const filteredIds = useMemo(() => {
    if (selectedNode === null) return parsedIds
    return parsedIds.filter(p => p.nodeId === selectedNode)
  }, [parsedIds, selectedNode])

  return (
    <div className="distribution-chart">
      <div className="chart-controls">
        <div className="view-mode-selector">
          <button
            className={viewMode === 'timeline' ? 'active' : ''}
            onClick={() => setViewMode('timeline')}
          >
            📊 Timeline
          </button>
          <button
            className={viewMode === 'heatmap' ? 'active' : ''}
            onClick={() => setViewMode('heatmap')}
          >
            🔥 Heatmap
          </button>
          <button
            className={viewMode === 'histogram' ? 'active' : ''}
            onClick={() => setViewMode('histogram')}
          >
            📈 Histogram
          </button>
        </div>

        <div className="node-filter">
          <label>Filter by Node:</label>
          <select
            value={selectedNode ?? 'all'}
            onChange={(e) => setSelectedNode(
              e.target.value === 'all' ? null : parseInt(e.target.value)
            )}
          >
            <option value="all">All Nodes ({ids.length})</option>
            {nodeIds.map(nodeId => {
              const count = ids.filter(i => i.nodeId === nodeId).length
              return (
                <option key={nodeId} value={nodeId}>
                  Node {nodeId} ({count})
                </option>
              )
            })}
          </select>
        </div>
      </div>

      <div className="chart-content">
        {viewMode === 'timeline' && (
          <TimelineView ids={filteredIds} nodeIds={nodeIds} />
        )}
        {viewMode === 'heatmap' && (
          <HeatmapView ids={filteredIds} tree={tree} />
        )}
        {viewMode === 'histogram' && (
          <HistogramView ids={filteredIds} nodeIds={nodeIds} />
        )}
      </div>
    </div>
  )
}

// Timeline View - shows ID distribution over time
interface TimelineViewProps {
  ids: { id: bigint; nodeId: number; components: ReturnType<typeof SnowflakeGenerator.parse> }[]
  nodeIds: number[]
}

function TimelineView({ ids, nodeIds }: TimelineViewProps) {
  if (ids.length === 0) {
    return <div className="empty-chart">No data to display</div>
  }

  const timestamps = ids.map(i => Number(i.components.timestamp))
  const minTime = Math.min(...timestamps)
  const maxTime = Math.max(...timestamps)
  const timeRange = maxTime - minTime || 1

  // Group by time buckets
  const bucketCount = 50
  const bucketSize = timeRange / bucketCount
  const buckets: Map<number, Map<number, number>> = new Map()

  for (let i = 0; i <= bucketCount; i++) {
    buckets.set(i, new Map())
  }

  for (const item of ids) {
    const time = Number(item.components.timestamp)
    const bucketIndex = Math.min(
      bucketCount,
      Math.floor((time - minTime) / bucketSize)
    )
    const bucket = buckets.get(bucketIndex)!
    bucket.set(item.nodeId, (bucket.get(item.nodeId) || 0) + 1)
  }

  const maxCount = Math.max(
    ...Array.from(buckets.values()).map(b => 
      Array.from(b.values()).reduce((a, c) => a + c, 0)
    )
  )

  return (
    <div className="timeline-view">
      <div className="timeline-chart">
        {Array.from(buckets.entries()).map(([index, nodeData]) => {
          const total = Array.from(nodeData.values()).reduce((a, c) => a + c, 0)
          const height = (total / maxCount) * 100

          return (
            <div key={index} className="timeline-bar-container">
              <div
                className="timeline-bar"
                style={{ height: `${height}%` }}
              >
                {nodeIds.map(nodeId => {
                  const count = nodeData.get(nodeId) || 0
                  if (count === 0) return null
                  const segmentHeight = (count / total) * 100
                  return (
                    <div
                      key={nodeId}
                      className="bar-segment"
                      style={{
                        height: `${segmentHeight}%`,
                        backgroundColor: `hsl(${(nodeId * 137.5) % 360}, 70%, 55%)`,
                      }}
                      title={`Node ${nodeId}: ${count}`}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="timeline-axis">
        <span>{new Date(minTime).toLocaleTimeString()}</span>
        <span>Timeline</span>
        <span>{new Date(maxTime).toLocaleTimeString()}</span>
      </div>
    </div>
  )
}

// Heatmap View - shows distribution across B+ Tree leaves
interface HeatmapViewProps {
  ids: { id: bigint; nodeId: number; components: ReturnType<typeof SnowflakeGenerator.parse> }[]
  tree: BPlusTree<bigint, number>
}

function HeatmapView({ tree }: HeatmapViewProps) {
  const leaves = tree.getAllLeaves()
  
  if (leaves.length === 0) {
    return <div className="empty-chart">No leaves in tree</div>
  }

  const maxKeys = Math.max(...leaves.map(l => l.keys.length))
  const totalKeys = leaves.reduce((sum, l) => sum + l.keys.length, 0)

  // Calculate node distribution per leaf
  const leafStats = leaves.map(leaf => {
    const nodeDistribution = new Map<number, number>()
    if (leaf.values) {
      for (const nodeId of leaf.values) {
        nodeDistribution.set(nodeId, (nodeDistribution.get(nodeId) || 0) + 1)
      }
    }
    return {
      leaf,
      keyCount: leaf.keys.length,
      nodeDistribution,
    }
  })

  return (
    <div className="heatmap-view">
      <div className="heatmap-header">
        <span>Leaf Nodes ({leaves.length})</span>
        <span>Total Keys: {totalKeys.toLocaleString()}</span>
      </div>
      <div className="heatmap-grid">
        {leafStats.map((stat, index) => {
          const intensity = stat.keyCount / maxKeys
          const dominantNode = Array.from(stat.nodeDistribution.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0]

          return (
            <div
              key={stat.leaf.id}
              className="heatmap-cell"
              style={{
                backgroundColor: `hsla(${
                  dominantNode !== undefined ? (dominantNode * 137.5) % 360 : 200
                }, 70%, 50%, ${0.2 + intensity * 0.8})`,
              }}
              title={`Leaf ${index + 1}: ${stat.keyCount} keys`}
            >
              <span className="cell-count">{stat.keyCount}</span>
            </div>
          )
        })}
      </div>
      <div className="heatmap-legend">
        <div className="legend-scale">
          <span>Low density</span>
          <div className="gradient-bar" />
          <span>High density</span>
        </div>
      </div>
    </div>
  )
}

// Histogram View - shows distribution by Snowflake node
interface HistogramViewProps {
  ids: { id: bigint; nodeId: number; components: ReturnType<typeof SnowflakeGenerator.parse> }[]
  nodeIds: number[]
}

function HistogramView({ ids, nodeIds }: HistogramViewProps) {
  const nodeCounts = new Map<number, number>()
  for (const item of ids) {
    nodeCounts.set(item.nodeId, (nodeCounts.get(item.nodeId) || 0) + 1)
  }

  const maxCount = Math.max(...nodeCounts.values())
  const avgCount = ids.length / nodeIds.length

  return (
    <div className="histogram-view">
      <div className="histogram-chart">
        {nodeIds.map(nodeId => {
          const count = nodeCounts.get(nodeId) || 0
          const height = (count / maxCount) * 100
          const isAboveAvg = count > avgCount

          return (
            <div key={nodeId} className="histogram-bar-container">
              <div className="bar-value">{count.toLocaleString()}</div>
              <div
                className={`histogram-bar ${isAboveAvg ? 'above-avg' : ''}`}
                style={{
                  height: `${height}%`,
                  backgroundColor: `hsl(${(nodeId * 137.5) % 360}, 70%, 55%)`,
                }}
              />
              <div className="bar-label">Node {nodeId}</div>
            </div>
          )
        })}
      </div>
      <div className="histogram-stats">
        <div className="stat">
          <span className="stat-label">Average</span>
          <span className="stat-value">{avgCount.toFixed(1)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Min</span>
          <span className="stat-value">{Math.min(...nodeCounts.values())}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Max</span>
          <span className="stat-value">{Math.max(...nodeCounts.values())}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Std Dev</span>
          <span className="stat-value">
            {calculateStdDev(Array.from(nodeCounts.values())).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const squareDiffs = values.map(v => Math.pow(v - avg, 2))
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(avgSquareDiff)
}

