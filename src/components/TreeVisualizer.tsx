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
const NODE_MIN_WIDTH = 80
const NODE_PADDING = 12
const LEVEL_GAP = 100
const NODE_GAP = 16
const CHAR_WIDTH = 7

export function TreeVisualizer({ tree }: TreeVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)

  // Calculate node positions using proper tree layout
  const { positions, connections, dimensions } = useMemo(() => {
    const root = tree.getTreeStructure()
    const positions: NodePosition[] = []
    const connections: Connection[] = []
    const nodePositionMap = new Map<number, NodePosition>()

    // Calculate width for each node based on keys
    const getNodeWidth = (node: BPlusTreeNode<bigint, number>) => {
      const keyCount = node.keys.length
      if (keyCount === 0) return NODE_MIN_WIDTH
      const displayText = node.keys.slice(0, 3).map(k => formatKey(k)).join(' | ')
      const textWidth = displayText.length * CHAR_WIDTH + (keyCount > 3 ? 30 : 0)
      return Math.max(NODE_MIN_WIDTH, textWidth + NODE_PADDING * 2)
    }

    // Calculate subtree width (for proper positioning)
    const calculateSubtreeWidth = (node: BPlusTreeNode<bigint, number>): number => {
      if (node.isLeaf || !node.children || node.children.length === 0) {
        return getNodeWidth(node)
      }
      
      let childrenWidth = 0
      for (let i = 0; i < node.children.length; i++) {
        childrenWidth += calculateSubtreeWidth(node.children[i])
        if (i < node.children.length - 1) {
          childrenWidth += NODE_GAP
        }
      }
      
      return Math.max(getNodeWidth(node), childrenWidth)
    }

    // Position nodes recursively
    const positionNode = (
      node: BPlusTreeNode<bigint, number>,
      x: number,
      y: number,
      availableWidth: number
    ): void => {
      const nodeWidth = getNodeWidth(node)
      const nodeX = x + (availableWidth - nodeWidth) / 2

      const pos: NodePosition = {
        node,
        x: nodeX,
        y,
        width: nodeWidth,
      }
      positions.push(pos)
      nodePositionMap.set(node.id, pos)

      if (!node.isLeaf && node.children && node.children.length > 0) {
        // Calculate children positions
        const childrenWidths = node.children.map(child => calculateSubtreeWidth(child))
        const totalChildrenWidth = childrenWidths.reduce((sum, w) => sum + w, 0) + 
          (node.children.length - 1) * NODE_GAP

        let childX = x + (availableWidth - totalChildrenWidth) / 2

        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i]
          const childWidth = childrenWidths[i]
          
          positionNode(child, childX, y + LEVEL_GAP, childWidth)
          
          // Add connection
          const childPos = nodePositionMap.get(child.id)
          if (childPos) {
            connections.push({
              from: { x: nodeX + nodeWidth / 2, y: y + NODE_HEIGHT },
              to: { x: childPos.x + childPos.width / 2, y: childPos.y },
            })
          }
          
          childX += childWidth + NODE_GAP
        }
      }
    }

    // Calculate total width and position tree
    const totalWidth = calculateSubtreeWidth(root)
    const treeHeight = getTreeHeight(root) * LEVEL_GAP

    positionNode(root, 0, 0, totalWidth)

    return {
      positions,
      connections,
      dimensions: {
        width: totalWidth + 100,
        height: treeHeight + 100,
      },
    }
  }, [tree])

  // Reset view when tree changes
  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth
      const treeWidth = dimensions.width
      
      // Auto-fit scale
      const fitScale = Math.min(1, (containerWidth - 100) / treeWidth)
      setScale(Math.max(0.2, fitScale))
      
      // Center horizontally
      const offsetX = Math.max(50, (containerWidth - treeWidth * fitScale) / 2)
      setOffset({ x: offsetX, y: 50 })
    }
  }, [tree, dimensions])

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
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth
      const fitScale = Math.min(1, (containerWidth - 100) / dimensions.width)
      setScale(Math.max(0.2, fitScale))
      const offsetX = Math.max(50, (containerWidth - dimensions.width * fitScale) / 2)
      setOffset({ x: offsetX, y: 50 })
    }
  }

  const handleFitView = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth
      const containerHeight = containerRef.current.clientHeight
      
      const scaleX = (containerWidth - 100) / dimensions.width
      const scaleY = (containerHeight - 100) / dimensions.height
      const fitScale = Math.min(scaleX, scaleY, 1)
      
      setScale(Math.max(0.1, fitScale))
      setOffset({
        x: (containerWidth - dimensions.width * fitScale) / 2,
        y: (containerHeight - dimensions.height * fitScale) / 2,
      })
    }
  }

  return (
    <div className="tree-visualizer">
      <div className="visualizer-controls">
        <button onClick={() => setScale(s => Math.min(3, s * 1.2))} title="Zoom In">
          <span>+</span>
        </button>
        <span className="zoom-level">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.max(0.1, s * 0.8))} title="Zoom Out">
          <span>−</span>
        </button>
        <button onClick={handleFitView} className="fit-btn" title="Fit to View">
          ⊡
        </button>
        <button onClick={handleReset} className="reset-btn" title="Reset View">
          Reset
        </button>
        <div className="tree-info">
          <span>Nodes: {positions.length}</span>
          <span>•</span>
          <span>Leaves: {positions.filter(p => p.node.isLeaf).length}</span>
        </div>
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
                    C ${conn.from.x} ${conn.from.y + 40},
                      ${conn.to.x} ${conn.to.y - 40},
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

                {/* Root indicator */}
                {pos.y === 0 && (
                  <text
                    className="root-label"
                    x={pos.width / 2}
                    y={-16}
                    textAnchor="middle"
                  >
                    ROOT
                  </text>
                )}
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

function getTreeHeight(node: BPlusTreeNode<bigint, number>): number {
  if (node.isLeaf || !node.children || node.children.length === 0) {
    return 1
  }
  return 1 + Math.max(...node.children.map(getTreeHeight))
}

function formatKey(key: bigint): string {
  const str = key.toString()
  if (str.length > 8) {
    return str.slice(0, 4) + '…' + str.slice(-3)
  }
  return str
}

function formatNodeKeys(node: BPlusTreeNode<bigint, number>): string {
  if (node.keys.length === 0) return '∅'
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
