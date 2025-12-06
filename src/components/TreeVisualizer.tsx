import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { BPlusTree, BPlusTreeNode } from '../lib/bplustree'
import './TreeVisualizer.css'

interface TreeVisualizerProps {
  tree: BPlusTree<bigint, number>
}

interface NodePosition {
  id: number
  x: number
  y: number
  width: number
  height: number
  isLeaf: boolean
  keyCount: number
  label: string
  // Snowflake node distribution for leaf nodes
  nodeDistribution?: Map<number, number>
  dominantNode?: number
}

interface Connection {
  fromX: number
  fromY: number
  toX: number
  toY: number
}

const NODE_HEIGHT = 36
const NODE_MIN_WIDTH = 70
const NODE_PADDING = 10
const LEVEL_GAP = 90
const NODE_GAP = 12
const CHAR_WIDTH = 6.5

// Colors
const COLORS = {
  bg: '#0d1117',
  nodeBg: '#1a1f2e',
  internalFill: 'rgba(0, 217, 255, 0.15)',
  internalStroke: '#00d9ff',
  text: '#e6edf3',
  textDark: '#0d1117',
  connection: '#30363d',
  badge: '#ff0080',
  rootLabel: '#ffcc00',
}

// Generate color for a snowflake node ID
function getNodeColor(nodeId: number, alpha: number = 1): string {
  const hue = (nodeId * 137.5) % 360
  return `hsla(${hue}, 75%, 55%, ${alpha})`
}

export function TreeVisualizer({ tree }: TreeVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<NodePosition | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  // Pre-calculate all node positions
  const { positions, connections, dimensions, stats, uniqueSnowflakeNodes } = useMemo(() => {
    const root = tree.getTreeStructure()
    const positions: NodePosition[] = []
    const connections: Connection[] = []
    const snowflakeNodesSet = new Set<number>()
    
    let leafCount = 0
    let internalCount = 0

    const getNodeWidth = (keyCount: number) => {
      if (keyCount === 0) return NODE_MIN_WIDTH
      const displayLen = Math.min(keyCount, 3) * 8 + (keyCount > 3 ? 3 : 0)
      return Math.max(NODE_MIN_WIDTH, displayLen * CHAR_WIDTH + NODE_PADDING * 2)
    }

    const formatLabel = (node: BPlusTreeNode<bigint, number>): string => {
      if (node.keys.length === 0) return '∅'
      const keys = node.keys.slice(0, 3).map(k => {
        const s = k.toString()
        return s.length > 6 ? s.slice(0, 3) + '…' + s.slice(-2) : s
      })
      return keys.join('|') + (node.keys.length > 3 ? '…' : '')
    }

    // Calculate node distribution for leaf nodes
    const getNodeDistribution = (node: BPlusTreeNode<bigint, number>): { dist: Map<number, number>; dominant: number } | null => {
      if (!node.isLeaf || !node.values || node.values.length === 0) return null
      
      const dist = new Map<number, number>()
      for (const nodeId of node.values) {
        snowflakeNodesSet.add(nodeId)
        dist.set(nodeId, (dist.get(nodeId) || 0) + 1)
      }
      
      // Find dominant node
      let dominant = 0
      let maxCount = 0
      for (const [nodeId, count] of dist) {
        if (count > maxCount) {
          maxCount = count
          dominant = nodeId
        }
      }
      
      return { dist, dominant }
    }

    // Calculate subtree width
    const subtreeWidths = new Map<number, number>()
    
    const calcSubtreeWidth = (node: BPlusTreeNode<bigint, number>): number => {
      const nodeWidth = getNodeWidth(node.keys.length)
      
      if (node.isLeaf || !node.children || node.children.length === 0) {
        subtreeWidths.set(node.id, nodeWidth)
        return nodeWidth
      }
      
      let childrenWidth = 0
      for (let i = 0; i < node.children.length; i++) {
        childrenWidth += calcSubtreeWidth(node.children[i])
        if (i < node.children.length - 1) childrenWidth += NODE_GAP
      }
      
      const width = Math.max(nodeWidth, childrenWidth)
      subtreeWidths.set(node.id, width)
      return width
    }

    // Position nodes
    const positionNode = (
      node: BPlusTreeNode<bigint, number>,
      x: number,
      y: number,
      availableWidth: number
    ): void => {
      const nodeWidth = getNodeWidth(node.keys.length)
      const nodeX = x + (availableWidth - nodeWidth) / 2

      const distribution = getNodeDistribution(node)

      if (node.isLeaf) leafCount++
      else internalCount++

      positions.push({
        id: node.id,
        x: nodeX,
        y,
        width: nodeWidth,
        height: NODE_HEIGHT,
        isLeaf: node.isLeaf,
        keyCount: node.keys.length,
        label: formatLabel(node),
        nodeDistribution: distribution?.dist,
        dominantNode: distribution?.dominant,
      })

      if (!node.isLeaf && node.children && node.children.length > 0) {
        const childrenWidths = node.children.map(c => subtreeWidths.get(c.id) || NODE_MIN_WIDTH)
        const totalChildrenWidth = childrenWidths.reduce((s, w) => s + w, 0) + 
          (node.children.length - 1) * NODE_GAP

        let childX = x + (availableWidth - totalChildrenWidth) / 2
        const fromX = nodeX + nodeWidth / 2
        const fromY = y + NODE_HEIGHT

        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i]
          const childWidth = childrenWidths[i]
          const childNodeWidth = getNodeWidth(child.keys.length)
          const childNodeX = childX + (childWidth - childNodeWidth) / 2
          
          connections.push({
            fromX,
            fromY,
            toX: childNodeX + childNodeWidth / 2,
            toY: y + LEVEL_GAP,
          })
          
          positionNode(child, childX, y + LEVEL_GAP, childWidth)
          childX += childWidth + NODE_GAP
        }
      }
    }

    const totalWidth = calcSubtreeWidth(root)
    positionNode(root, 0, 0, totalWidth)

    // Calculate tree height
    let maxY = 0
    for (const pos of positions) {
      if (pos.y > maxY) maxY = pos.y
    }

    const uniqueSnowflakeNodes = Array.from(snowflakeNodesSet).sort((a, b) => a - b)

    return {
      positions,
      connections,
      dimensions: { width: totalWidth + 100, height: maxY + NODE_HEIGHT + 100 },
      stats: { total: positions.length, leaves: leafCount, internal: internalCount },
      uniqueSnowflakeNodes,
    }
  }, [tree])

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setCanvasSize({ width, height })
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Initial fit
  useEffect(() => {
    if (canvasSize.width > 0) {
      const scaleX = (canvasSize.width - 80) / dimensions.width
      const scaleY = (canvasSize.height - 80) / dimensions.height
      const fitScale = Math.min(scaleX, scaleY, 1)
      setScale(Math.max(0.05, fitScale))
      setOffset({
        x: (canvasSize.width - dimensions.width * fitScale) / 2,
        y: 40,
      })
    }
  }, [tree, dimensions, canvasSize])

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasSize.width * dpr
    canvas.height = canvasSize.height * dpr
    ctx.scale(dpr, dpr)

    // Clear
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height)

    ctx.save()
    ctx.translate(offset.x, offset.y)
    ctx.scale(scale, scale)

    // Viewport culling bounds
    const viewLeft = -offset.x / scale - 100
    const viewRight = (canvasSize.width - offset.x) / scale + 100
    const viewTop = -offset.y / scale - 100
    const viewBottom = (canvasSize.height - offset.y) / scale + 100

    // Draw connections
    ctx.strokeStyle = COLORS.connection
    ctx.lineWidth = scale < 0.3 ? 1 : 1.5

    if (scale > 0.1) {
      ctx.beginPath()
      for (const conn of connections) {
        if (conn.fromX < viewLeft || conn.fromX > viewRight) continue
        if (conn.toY < viewTop || conn.fromY > viewBottom) continue

        if (scale < 0.3) {
          ctx.moveTo(conn.fromX, conn.fromY)
          ctx.lineTo(conn.toX, conn.toY)
        } else {
          ctx.moveTo(conn.fromX, conn.fromY)
          ctx.bezierCurveTo(
            conn.fromX, conn.fromY + 35,
            conn.toX, conn.toY - 35,
            conn.toX, conn.toY
          )
        }
      }
      ctx.stroke()
    }

    // Draw nodes
    const showDetails = scale > 0.15
    const showText = scale > 0.08
    const showBadge = scale > 0.2

    for (const pos of positions) {
      if (pos.x + pos.width < viewLeft || pos.x > viewRight) continue
      if (pos.y + pos.height < viewTop || pos.y > viewBottom) continue

      const isHovered = hoveredNode?.id === pos.id

      if (pos.isLeaf && pos.dominantNode !== undefined) {
        // Leaf node - color by dominant snowflake node
        if (showDetails) {
          ctx.fillStyle = getNodeColor(pos.dominantNode, 0.35)
          ctx.strokeStyle = getNodeColor(pos.dominantNode, 1)
          ctx.lineWidth = isHovered ? 3 : 2

          ctx.beginPath()
          roundRect(ctx, pos.x, pos.y, pos.width, pos.height, 5)
          ctx.fill()
          ctx.stroke()
        } else {
          ctx.fillStyle = getNodeColor(pos.dominantNode, 0.9)
          ctx.fillRect(pos.x, pos.y, pos.width, pos.height)
        }
      } else {
        // Internal node
        if (showDetails) {
          ctx.fillStyle = COLORS.internalFill
          ctx.strokeStyle = COLORS.internalStroke
          ctx.lineWidth = isHovered ? 2.5 : 1.5

          ctx.beginPath()
          roundRect(ctx, pos.x, pos.y, pos.width, pos.height, 5)
          ctx.fill()
          ctx.stroke()
        } else {
          ctx.fillStyle = COLORS.internalStroke
          ctx.fillRect(pos.x, pos.y, pos.width, pos.height)
        }
      }

      // Node text
      if (showText) {
        ctx.fillStyle = COLORS.text
        ctx.font = `${showDetails ? 10 : 8}px "JetBrains Mono", monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          showDetails ? pos.label : `${pos.keyCount}`,
          pos.x + pos.width / 2,
          pos.y + pos.height / 2
        )
      }

      // Badge showing dominant node ID for leaves
      if (showBadge && pos.isLeaf && pos.dominantNode !== undefined) {
        const badgeX = pos.x + pos.width - 6
        const badgeY = pos.y - 6
        ctx.fillStyle = getNodeColor(pos.dominantNode, 1)
        ctx.beginPath()
        ctx.arc(badgeX, badgeY, 9, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 8px "JetBrains Mono", monospace'
        ctx.fillText(`N${pos.dominantNode}`, badgeX, badgeY)
      } else if (showBadge && !pos.isLeaf) {
        const badgeX = pos.x + pos.width - 6
        const badgeY = pos.y - 6
        ctx.fillStyle = COLORS.badge
        ctx.beginPath()
        ctx.arc(badgeX, badgeY, 8, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 8px "JetBrains Mono", monospace'
        ctx.fillText(pos.keyCount.toString(), badgeX, badgeY)
      }

      // Root label
      if (pos.y === 0 && showDetails) {
        ctx.fillStyle = COLORS.rootLabel
        ctx.font = 'bold 9px "JetBrains Mono", monospace'
        ctx.fillText('ROOT', pos.x + pos.width / 2, pos.y - 12)
      }
    }

    ctx.restore()

    // Draw stats overlay (top right)
    ctx.fillStyle = 'rgba(13, 17, 23, 0.9)'
    ctx.fillRect(canvasSize.width - 150, 10, 140, 60)
    ctx.strokeStyle = COLORS.connection
    ctx.strokeRect(canvasSize.width - 150, 10, 140, 60)
    
    ctx.fillStyle = COLORS.text
    ctx.font = '11px "JetBrains Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`Nodes: ${stats.total.toLocaleString()}`, canvasSize.width - 140, 30)
    ctx.fillText(`Internal: ${stats.internal.toLocaleString()}`, canvasSize.width - 140, 45)
    ctx.fillText(`Leaves: ${stats.leaves.toLocaleString()}`, canvasSize.width - 140, 60)

    // Draw color legend (bottom left)
    const legendX = 10
    const legendY = canvasSize.height - 20 - uniqueSnowflakeNodes.length * 22
    const legendWidth = 140
    const legendHeight = uniqueSnowflakeNodes.length * 22 + 30

    ctx.fillStyle = 'rgba(13, 17, 23, 0.9)'
    ctx.fillRect(legendX, legendY, legendWidth, legendHeight)
    ctx.strokeStyle = COLORS.connection
    ctx.strokeRect(legendX, legendY, legendWidth, legendHeight)

    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 11px "JetBrains Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('Snowflake Nodes', legendX + 10, legendY + 18)

    // Draw each node color
    for (let i = 0; i < uniqueSnowflakeNodes.length; i++) {
      const nodeId = uniqueSnowflakeNodes[i]
      const itemY = legendY + 32 + i * 22

      // Color box
      ctx.fillStyle = getNodeColor(nodeId, 1)
      ctx.fillRect(legendX + 10, itemY, 16, 16)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      ctx.strokeRect(legendX + 10, itemY, 16, 16)

      // Label
      ctx.fillStyle = COLORS.text
      ctx.font = '10px "JetBrains Mono", monospace'
      ctx.fillText(`Node ${nodeId}`, legendX + 34, itemY + 12)
    }

    // If too many nodes, show abbreviated legend
    if (uniqueSnowflakeNodes.length > 10) {
      ctx.fillStyle = 'rgba(13, 17, 23, 0.9)'
      ctx.fillRect(legendX, canvasSize.height - 80, legendWidth, 70)
      ctx.strokeStyle = COLORS.connection
      ctx.strokeRect(legendX, canvasSize.height - 80, legendWidth, 70)

      ctx.fillStyle = COLORS.text
      ctx.font = 'bold 11px "JetBrains Mono", monospace'
      ctx.fillText('Snowflake Nodes', legendX + 10, canvasSize.height - 62)
      ctx.font = '10px "JetBrains Mono", monospace'
      ctx.fillText(`${uniqueSnowflakeNodes.length} nodes total`, legendX + 10, canvasSize.height - 44)
      ctx.fillText('Color = Node ID × 137.5°', legendX + 10, canvasSize.height - 26)
    }

  }, [positions, connections, offset, scale, canvasSize, hoveredNode, stats, uniqueSnowflakeNodes])

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }
  }, [offset])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left - offset.x) / scale
    const mouseY = (e.clientY - rect.top - offset.y) / scale

    let found: NodePosition | null = null
    for (const pos of positions) {
      if (
        mouseX >= pos.x &&
        mouseX <= pos.x + pos.width &&
        mouseY >= pos.y &&
        mouseY <= pos.y + pos.height
      ) {
        found = pos
        break
      }
    }
    
    if (found?.id !== hoveredNode?.id) {
      setHoveredNode(found)
    }
  }, [isDragging, dragStart, offset, scale, positions, hoveredNode])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.85 : 1.15
    const newScale = Math.max(0.02, Math.min(3, scale * delta))
    
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      setOffset(prev => ({
        x: mouseX - (mouseX - prev.x) * (newScale / scale),
        y: mouseY - (mouseY - prev.y) * (newScale / scale),
      }))
    }
    
    setScale(newScale)
  }, [scale])

  const handleFitView = useCallback(() => {
    const scaleX = (canvasSize.width - 80) / dimensions.width
    const scaleY = (canvasSize.height - 80) / dimensions.height
    const fitScale = Math.min(scaleX, scaleY, 1)
    setScale(Math.max(0.02, fitScale))
    setOffset({
      x: (canvasSize.width - dimensions.width * fitScale) / 2,
      y: (canvasSize.height - dimensions.height * fitScale) / 2,
    })
  }, [canvasSize, dimensions])

  return (
    <div className="tree-visualizer">
      <div className="visualizer-controls">
        <button onClick={() => setScale(s => Math.min(3, s * 1.3))} title="Zoom In">+</button>
        <span className="zoom-level">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.max(0.02, s * 0.7))} title="Zoom Out">−</button>
        <button onClick={handleFitView} className="fit-btn" title="Fit to View">⊡</button>
        <button onClick={() => { setScale(1); setOffset({ x: 50, y: 50 }) }} className="reset-btn">Reset</button>
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
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={{ width: canvasSize.width, height: canvasSize.height }}
        />

        {/* Tooltip */}
        {hoveredNode && scale > 0.15 && (
          <div
            className="node-tooltip"
            style={{
              left: offset.x + (hoveredNode.x + hoveredNode.width / 2) * scale,
              top: offset.y + (hoveredNode.y + hoveredNode.height + 8) * scale,
            }}
          >
            <div className="tooltip-header">
              {hoveredNode.isLeaf ? '🍃 Leaf' : '🔷 Internal'}
            </div>
            <div className="tooltip-content">
              <div className="tooltip-row">
                <span>ID:</span><span>{hoveredNode.id}</span>
              </div>
              <div className="tooltip-row">
                <span>Keys:</span><span>{hoveredNode.keyCount}</span>
              </div>
              {hoveredNode.isLeaf && hoveredNode.nodeDistribution && (
                <>
                  <div className="tooltip-divider" />
                  <div className="tooltip-row">
                    <span>Dominant:</span>
                    <span style={{ color: getNodeColor(hoveredNode.dominantNode!, 1) }}>
                      Node {hoveredNode.dominantNode}
                    </span>
                  </div>
                  <div className="tooltip-distribution">
                    {Array.from(hoveredNode.nodeDistribution.entries())
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([nodeId, count]) => (
                        <div key={nodeId} className="dist-item">
                          <span 
                            className="dist-color" 
                            style={{ backgroundColor: getNodeColor(nodeId, 1) }}
                          />
                          <span>N{nodeId}: {count}</span>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="visualizer-legend">
        <div className="legend-item">
          <span className="legend-dot internal" />
          <span>Internal</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot leaf" />
          <span>Leaf (colored by Node)</span>
        </div>
        <div className="legend-hint">
          {stats.total.toLocaleString()} nodes • {uniqueSnowflakeNodes.length} snowflake nodes
        </div>
      </div>
    </div>
  )
}

// Helper for rounded rectangles
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
