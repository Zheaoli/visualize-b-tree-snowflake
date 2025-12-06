import { useState, useCallback } from 'react'
import { MultiNodeSnowflakeManager, SnowflakeGenerator } from './lib/snowflake'
import { BPlusTree, createBigIntTree, TreeStats } from './lib/bplustree'
import { TreeVisualizer } from './components/TreeVisualizer'
import { DistributionChart } from './components/DistributionChart'
import { ControlPanel } from './components/ControlPanel'
import { StatsPanel } from './components/StatsPanel'
import './App.css'

export interface GeneratedData {
  tree: BPlusTree<bigint, number>;
  ids: { id: bigint; nodeId: number }[];
  stats: TreeStats;
  nodeDistribution: Map<number, number>; // nodeId -> count
}

function App() {
  const [nodeCount, setNodeCount] = useState(5)
  const [idsPerNode, setIdsPerNode] = useState(100)
  const [treeOrder, setTreeOrder] = useState(8)
  const [data, setData] = useState<GeneratedData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<'tree' | 'distribution'>('tree')

  const handleGenerate = useCallback(() => {
    setIsGenerating(true)
    
    // Use setTimeout to allow UI update
    setTimeout(() => {
      try {
        BPlusTree.resetNodeIdCounter()
        
        // Create multi-node manager and generate IDs
        const manager = new MultiNodeSnowflakeManager()
        const ids = manager.generateForNodes(nodeCount, idsPerNode)
        
        // Create B+ Tree and insert all IDs
        const tree = createBigIntTree<number>(treeOrder)
        
        for (const { id, nodeId } of ids) {
          tree.insert(id, nodeId)
        }
        
        // Calculate ID distribution per Snowflake node
        const nodeDistribution = new Map<number, number>()
        for (const { nodeId } of ids) {
          nodeDistribution.set(nodeId, (nodeDistribution.get(nodeId) || 0) + 1)
        }
        
        setData({
          tree,
          ids,
          stats: tree.getStats(),
          nodeDistribution,
        })
      } catch (error) {
        console.error('Generation error:', error)
      } finally {
        setIsGenerating(false)
      }
    }, 50)
  }, [nodeCount, idsPerNode, treeOrder])

  const handleClear = useCallback(() => {
    setData(null)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <h1>B+ Tree <span className="highlight">×</span> Snowflake</h1>
          </div>
          <p className="subtitle">
            Visualize Snowflake ID distribution in B+ Tree structure
          </p>
        </div>
        <div className="header-decoration" />
      </header>
 
      <main className="app-main">
        <aside className="sidebar">
          <ControlPanel
            nodeCount={nodeCount}
            idsPerNode={idsPerNode}
            treeOrder={treeOrder}
            onNodeCountChange={setNodeCount}
            onIdsPerNodeChange={setIdsPerNode}
            onTreeOrderChange={setTreeOrder}
            onGenerate={handleGenerate}
            onClear={handleClear}
            isGenerating={isGenerating}
            hasData={!!data}
          />
          
          {data && <StatsPanel stats={data.stats} nodeDistribution={data.nodeDistribution} />}
        </aside>

        <section className="content">
          {data ? (
            <>
              <div className="tab-bar">
                <button
                  className={`tab-button ${activeTab === 'tree' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tree')}
                >
                  <span className="tab-icon">🌳</span>
                  Tree Structure
                </button>
                <button
                  className={`tab-button ${activeTab === 'distribution' ? 'active' : ''}`}
                  onClick={() => setActiveTab('distribution')}
                >
                  <span className="tab-icon">📊</span>
                  ID Distribution
                </button>
              </div>
              
              <div className="visualization-container">
                {activeTab === 'tree' ? (
                  <TreeVisualizer tree={data.tree} />
                ) : (
                  <DistributionChart ids={data.ids} tree={data.tree} />
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🌲</div>
              <h2>Ready to Visualize</h2>
              <p>
                Configure the parameters and click <strong>Generate</strong> to create 
                Snowflake IDs and visualize their distribution in a B+ Tree.
              </p>
              <div className="empty-state-hint">
                <div className="hint-item">
                  <span className="hint-number">1</span>
                  <span>Set number of unique nodes (machines)</span>
                </div>
                <div className="hint-item">
                  <span className="hint-number">2</span>
                  <span>Set IDs per node</span>
                </div>
                <div className="hint-item">
                  <span className="hint-number">3</span>
                  <span>Adjust B+ Tree order</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App

