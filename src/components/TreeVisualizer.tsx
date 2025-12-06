import { useMemo, useRef, useState, useEffect } from 'react'
import { BPlusTree, BPlusTreeNode } from '../lib/bplustree'
import './TreeVisualizer.css'

interface TreeVisualizerProps {
  tree: BPlusTree<bigint, number>
}

interface NodePosition {
  node: BPlusTreeNode<bigint, number>
  x: number
  y: number
  width: number
}

interface Connection {
  from: { x: number; y: number }
  to: { x: number; y: number }
}

const NODE_HEIGHT = 40
const NODE_MIN_WIDTH = 60
const NODE_PADDING = 8
const LEVEL_GAP = 80
const NODE_GAP = 20
const CHAR_WIDTH = 8

export function TreeVisualizer({ tree }: TreeVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)

  const levels = useMemo(() => tree.getLevelOrder(), [tree])

  // Calculate node positions
  const { positions, connections, dimensions } = useMemo(() => {
    const positions: NodePosition[] = []
    const connections: Connection[] = []
    const nodePositionMap = new Map<number, NodePosition>()

    // Calculate width for each node based on keys
    const getNodeWidth = (node: BPlusTreeNode<bigint, number>) => {
      const keyCount = node.keys.length
      const displayText = node.keys.slice(0, 3).map(k => formatKey(k)).join(' | ')
      const textWidth = displayText.length * CHAR_WIDTH + (keyCount > 3 ? 30 : 0)
      return Math.max(NODE_MIN_WIDTH, textWidth + NODE_PADDING * 2)
    }

    // First pass: calculate positions bottom-up for leaf placement
    const levelWidths: number[] = []
    const levelNodes: { node: BPlusTreeNode<bigint, number>; width: number }[][] = []

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i]
      const nodes = level.map(node => ({
        node,
        width: getNodeWidth(node),
      }))
      levelNodes.push(nodes)
      const totalWidth = nodes.reduce((sum, n) => sum + n.width, 0) + (nodes.length - 1) * NODE_GAP
      levelWidths.push(totalWidth)
    }

    const maxWidth = Math.max(...levelWidths)

    // Second pass: assign x positions centered
    for (let i = 0; i < levelNodes.length; i++) {
      const nodes = levelNodes[i]
      const totalWidth = levelWidths[i]
      let startX = (maxWidth - totalWidth) / 2

      for (const { node, width } of nodes) {
        const pos: NodePosition = {
          node,
          x: startX,
          y: i * LEVEL_GAP,
          width,
        }
        positions.push(pos)
        nodePositionMap.set(node.id, pos)
        startX += width + NODE_GAP
      }
    }

    // Calculate connections
    for (const pos of positions) {
      if (!pos.node.isLeaf && pos.node.children) {
        for (const child of pos.node.children) {
          const childPos = nodePositionMap.get(child.id)
          if (childPos) {
            connections.push({
              from: { x: pos.x + pos.width / 2, y: pos.y + NODE_HEIGHT },
              to: { x: childPos.x + childPos.width / 2, y: childPos.y },
            })
          }
        }
      }
    }

    return {
      positions,
      connections,
      dimensions: {
        width: maxWidth + 100,
        height: levels.length * LEVEL_GAP + 100,
      },
    }
  }, [levels])

  // Reset view when tree changes
  useEffect(() => {
    setScale(1)
    setOffset({ x: 50, y: 50 })
  }, [tree])

  // Mouse handlers for pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Wheel handler for zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(3, scale * delta))
    setScale(newScale)
  }

  const handleReset = () => {
    setScale(1)
    setOffset({ x: 50, y: 50 })
  }

  return (
    <div className="tree-visualizer">
      <div className="visualizer-controls">
        <button onClick={() => setScale(s => Math.min(3, s * 1.2))}>
          <span>+</span>
        </button>
        <span className="zoom-level">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.max(0.1, s * 0.8))}>
          <span>−</span>
        </button>
        <button onClick={handleReset} className="reset-btn">
          Reset
        </button>
      </div>

      <div
        ref={containerRef}
        className="tree-canvas-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          className="tree-canvas"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
          width={dimensions.width}
          height={dimensions.height}
        >
          {/* Connections */}
          <g className="connections">
            {connections.map((conn, i) => (
              <path
                key={i}
                className="connection-line"
                d={`M ${conn.from.x} ${conn.from.y} 
                    C ${conn.from.x} ${conn.from.y + 30},
                      ${conn.to.x} ${conn.to.y - 30},
                      ${conn.to.x} ${conn.to.y}`}
              />
            ))}
          </g>

          {/* Nodes */}
          <g className="nodes">
            {positions.map((pos) => (
              <g
                key={pos.node.id}
                className={`tree-node ${pos.node.isLeaf ? 'leaf' : 'internal'} ${
                  hoveredNode === pos.node.id ? 'hovered' : ''
                }`}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseEnter={() => setHoveredNode(pos.node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <rect
                  className="node-bg"
                  width={pos.width}
                  height={NODE_HEIGHT}
                  rx={6}
                  ry={6}
                />
                <text
                  className="node-text"
                  x={pos.width / 2}
                  y={NODE_HEIGHT / 2}
                  dominantBaseline="middle"
                  textAnchor="middle"
                >
                  {formatNodeKeys(pos.node)}
                </text>
                
                {/* Key count badge */}
                <g transform={`translate(${pos.width - 8}, -8)`}>
                  <circle className="badge" r={10} />
                  <text
                    className="badge-text"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {pos.node.keys.length}
                  </text>
                </g>
              </g>
            ))}
          </g>
        </svg>

        {/* Tooltip */}
        {hoveredNode !== null && (
          <NodeTooltip
            node={positions.find(p => p.node.id === hoveredNode)?.node}
            offset={offset}
            scale={scale}
            position={positions.find(p => p.node.id === hoveredNode)}
          />
        )}
      </div>

      <div className="visualizer-legend">
        <div className="legend-item">
          <span className="legend-dot internal" />
          <span>Internal Node</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot leaf" />
          <span>Leaf Node</span>
        </div>
        <div className="legend-hint">
          Drag to pan • Scroll to zoom
        </div>
      </div>
    </div>
  )
}

function formatKey(key: bigint): string {
  const str = key.toString()
  if (str.length > 6) {
    return str.slice(0, 3) + '…' + str.slice(-3)
  }
  return str
}

function formatNodeKeys(node: BPlusTreeNode<bigint, number>): string {
  const keys = node.keys.slice(0, 3).map(k => formatKey(k))
  if (node.keys.length > 3) {
    keys.push('…')
  }
  return keys.join(' | ')
}

interface TooltipProps {
  node?: BPlusTreeNode<bigint, number>
  offset: { x: number; y: number }
  scale: number
  position?: NodePosition
}

function NodeTooltip({ node, offset, scale, position }: TooltipProps) {
  if (!node || !position) return null

  return (
    <div
      className="node-tooltip"
      style={{
        left: offset.x + (position.x + position.width / 2) * scale,
        top: offset.y + (position.y + NODE_HEIGHT + 10) * scale,
      }}
    >
      <div className="tooltip-header">
        {node.isLeaf ? '🍃 Leaf Node' : '🔷 Internal Node'}
      </div>
      <div className="tooltip-content">
        <div className="tooltip-row">
          <span>Node ID:</span>
          <span>{node.id}</span>
        </div>
        <div className="tooltip-row">
          <span>Keys:</span>
          <span>{node.keys.length}</span>
        </div>
        {node.isLeaf && (
          <div className="tooltip-row">
            <span>Values:</span>
            <span>{node.values?.length || 0}</span>
          </div>
        )}
        {!node.isLeaf && (
          <div className="tooltip-row">
            <span>Children:</span>
            <span>{node.children?.length || 0}</span>
          </div>
        )}
        <div className="tooltip-keys">
          <span>Key range:</span>
          <span className="key-range">
            {node.keys.length > 0 ? (
              <>
                {formatKey(node.keys[0])} → {formatKey(node.keys[node.keys.length - 1])}
              </>
            ) : (
              'Empty'
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

