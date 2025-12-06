# B+ Tree × ID Visualizer

An interactive visualization tool for exploring how distributed ID generation algorithms (Snowflake ID & UUIDv7) distribute across B+ Tree data structures.

![B+ Tree Visualization](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)

## Features

### ID Generation Algorithms

- **❄️ Snowflake ID (64-bit)**
  - Twitter's distributed ID generation algorithm
  - Structure: 41-bit timestamp + 10-bit node ID + 12-bit sequence
  - Supports up to 1024 nodes, 4096 IDs per millisecond per node

- **🆔 UUIDv7 (128-bit)**
  - Time-ordered UUID standard (RFC 9562)
  - Structure: 48-bit timestamp + 4-bit version + 12-bit sequence + 10-bit device ID + random
  - Sortable and database-friendly

### Visualization

- **🌳 B+ Tree Structure View**
  - Interactive canvas-based rendering (supports 50,000+ nodes)
  - Pan, zoom, and fit-to-view controls
  - Color-coded leaf nodes by source node/device
  - Hover tooltips with node details

- **📊 ID Distribution Charts**
  - Timeline view: ID generation over time
  - Heatmap view: Key density across leaf nodes
  - Histogram view: Distribution by node/device

### Performance

- **⚡ Parallel Generation**: Web Workers for true multi-threaded ID generation
- **🎯 Viewport Culling**: Only renders visible nodes
- **📈 Level of Detail**: Simplified rendering at low zoom levels
- **🔄 Progress Tracking**: Real-time progress during generation

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourname/visualize-b-tree-snowflake.git
cd visualize-b-tree-snowflake

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Build

```bash
pnpm build
pnpm preview
```

## Usage

1. **Choose ID Type**: Select between Snowflake ID or UUIDv7
2. **Configure Parameters**:
   - **Unique Nodes/Devices**: Number of ID generators (1-1024)
   - **IDs per Node**: Number of IDs each node generates
   - **B+ Tree Order**: Maximum children per node (affects tree height)
3. **Generate**: Click to generate IDs and build the B+ Tree
4. **Explore**: 
   - Switch between Tree Structure and Distribution views
   - Pan (drag) and zoom (scroll) the tree visualization
   - Hover over nodes to see details

## Project Structure

```
src/
├── lib/
│   ├── snowflake.ts          # Snowflake ID generator
│   ├── snowflake.worker.ts   # Snowflake Web Worker
│   ├── uuidv7.ts             # UUIDv7 generator
│   ├── uuidv7.worker.ts      # UUIDv7 Web Worker
│   ├── bplustree.ts          # B+ Tree implementation
│   └── parallelGenerator.ts  # Parallel generation orchestrator
├── components/
│   ├── TreeVisualizer.tsx    # Canvas-based tree visualization
│   ├── DistributionChart.tsx # Distribution charts
│   ├── ControlPanel.tsx      # Configuration controls
│   └── StatsPanel.tsx        # Statistics display
└── App.tsx                   # Main application
```

## Technical Details

### Snowflake ID Structure (64-bit)

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                         timestamp (41 bits)                   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|  timestamp  |   node ID (10 bits)   |   sequence (12 bits)   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

### UUIDv7 Structure (128-bit)

```
xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx

 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                         unix_ts_ms (32 bits)                  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          unix_ts_ms           |  ver  |       seq_hi          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|var|        device_id          |            random             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                            random                             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

### B+ Tree Properties

- All data stored in leaf nodes
- Internal nodes contain only keys for navigation
- Leaf nodes linked for efficient range queries
- Self-balancing on insertions
- Height: O(log_m(n)) where m is the order

## Why This Matters

Understanding how distributed IDs distribute across B+ Trees is crucial for:

- **Database Performance**: IDs affect index locality and page splits
- **Write Amplification**: Sequential vs random ID patterns
- **Hot Spots**: Time-based IDs can cause write concentration
- **Sharding**: Node ID distribution affects data locality

## License

ISC License

