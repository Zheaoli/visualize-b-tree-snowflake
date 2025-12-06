import { useState, useCallback } from 'react'
import { BPlusTree, createBigIntTree, TreeStats } from './lib/bplustree'
import { generateIdsParallel, generateIdsSync, IdType } from './lib/parallelGenerator'
import { TreeVisualizer } from './components/TreeVisualizer'
import { DistributionChart } from './components/DistributionChart'
import { ControlPanel } from './components/ControlPanel'
import { StatsPanel } from './components/StatsPanel'
import './App.css'

export interface GeneratedData {
  tree: BPlusTree<bigint, number>;
  ids: { id: bigint; nodeId: number; raw?: string }[];
  stats: TreeStats;
  nodeDistribution: Map<number, number>;
  generationTime: number;
  idType: IdType;
}

function App() {
  const [nodeCount, setNodeCount] = useState(5)
  const [idsPerNode, setIdsPerNode] = useState(100)
  const [treeOrder, setTreeOrder] = useState(8)
  const [idType, setIdType] = useState<IdType>('snowflake')
  const [data, setData] = useState<GeneratedData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState({ phase: '', percent: 0 })
  const [activeTab, setActiveTab] = useState<'tree' | 'distribution'>('tree')

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setProgress({ phase: 'Generating IDs...', percent: 0 })
    
    const startTime = performance.now()
    
    try {
      BPlusTree.resetNodeIdCounter()
      
      const totalIds = nodeCount * idsPerNode
      const idTypeName = idType === 'snowflake' ? 'Snowflake IDs' : 'UUIDv7s'
      let ids: { id: bigint; nodeId: number; raw?: string }[]
      
      if (totalIds > 5000) {
        ids = await generateIdsParallel(
          nodeCount,
          idsPerNode,
          idType,
          (completed, total) => {
            setProgress({
              phase: `Generating ${idTypeName} (${completed}/${total} nodes)...`,
              percent: Math.round((completed / total) * 50),
            })
          }
        )
      } else {
        ids = generateIdsSync(nodeCount, idsPerNode, idType)
        setProgress({ phase: `Generating ${idTypeName}...`, percent: 50 })
      }
      
      setProgress({ phase: 'Building B+ Tree...', percent: 55 })
      const tree = createBigIntTree<number>(treeOrder)
      
      const CHUNK_SIZE = 10000
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE)
        for (const { id, nodeId } of chunk) {
          tree.insert(id, nodeId)
        }
        
        const insertProgress = 55 + Math.round((i / ids.length) * 40)
        setProgress({
          phase: `Inserting into tree (${Math.min(i + CHUNK_SIZE, ids.length).toLocaleString()}/${ids.length.toLocaleString()})...`,
          percent: insertProgress,
        })
        
        if (i + CHUNK_SIZE < ids.length) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }
      
      setProgress({ phase: 'Calculating statistics...', percent: 95 })
      const nodeDistribution = new Map<number, number>()
      for (const { nodeId } of ids) {
        nodeDistribution.set(nodeId, (nodeDistribution.get(nodeId) || 0) + 1)
      }
      
      const endTime = performance.now()
      
      setProgress({ phase: 'Done!', percent: 100 })
      
      setData({
        tree,
        ids,
        stats: tree.getStats(),
        nodeDistribution,
        generationTime: endTime - startTime,
        idType,
      })
    } catch (error) {
      console.error('Generation error:', error)
      setProgress({ phase: 'Error!', percent: 0 })
    } finally {
      setIsGenerating(false)
    }
  }, [nodeCount, idsPerNode, treeOrder, idType])

  const handleClear = useCallback(() => {
    setData(null)
    setProgress({ phase: '', percent: 0 })
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <h1>B+ Tree <span className="highlight">×</span> ID Visualizer</h1>
          </div>
          <p className="subtitle">
            Visualize Snowflake ID & UUIDv7 distribution in B+ Tree structure
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
            idType={idType}
            onNodeCountChange={setNodeCount}
            onIdsPerNodeChange={setIdsPerNode}
            onTreeOrderChange={setTreeOrder}
            onIdTypeChange={setIdType}
            onGenerate={handleGenerate}
            onClear={handleClear}
            isGenerating={isGenerating}
            hasData={!!data}
            progress={progress}
          />
          
          {data && (
            <StatsPanel 
              stats={data.stats} 
              nodeDistribution={data.nodeDistribution}
              generationTime={data.generationTime}
              idType={data.idType}
            />
          )}
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
                IDs and visualize their distribution in a B+ Tree.
              </p>
              <div className="empty-state-hint">
                <div className="hint-item">
                  <span className="hint-number">1</span>
                  <span>Choose ID type (Snowflake or UUIDv7)</span>
                </div>
                <div className="hint-item">
                  <span className="hint-number">2</span>
                  <span>Set number of unique nodes/devices</span>
                </div>
                <div className="hint-item">
                  <span className="hint-number">3</span>
                  <span>Set IDs per node and B+ Tree order</span>
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
