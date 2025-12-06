/**
 * Parallel Snowflake ID Generator
 * Uses Web Workers for true parallel generation across multiple nodes
 */

interface GeneratedId {
  id: bigint;
  nodeId: number;
}

interface WorkerResponse {
  type: 'result';
  nodeId: number;
  ids: string[];
}

// Check if Web Workers are available
const supportsWorkers = typeof Worker !== 'undefined';

/**
 * Generate IDs in parallel using Web Workers
 */
export async function generateIdsParallel(
  nodeCount: number,
  idsPerNode: number,
  onProgress?: (completed: number, total: number) => void
): Promise<GeneratedId[]> {
  if (!supportsWorkers || nodeCount <= 2) {
    // Fallback to chunked generation for small node counts or no worker support
    return generateIdsChunked(nodeCount, idsPerNode, onProgress);
  }

  return new Promise((resolve, reject) => {
    const results: GeneratedId[] = [];
    let completedNodes = 0;
    const workers: Worker[] = [];

    // Determine optimal worker count (don't exceed available cores or node count)
    const maxWorkers = Math.min(
      navigator.hardwareConcurrency || 4,
      nodeCount,
      8 // Cap at 8 workers
    );

    // Create worker pool
    const workerUrl = new URL('./snowflake.worker.ts', import.meta.url);
    
    // Queue of nodes to process
    const nodeQueue: number[] = [];
    for (let i = 0; i < nodeCount; i++) {
      nodeQueue.push(i);
    }

    const processNext = (worker: Worker) => {
      const nodeId = nodeQueue.shift();
      if (nodeId !== undefined) {
        worker.postMessage({
          type: 'generate',
          nodeId,
          count: idsPerNode,
        });
      } else {
        // No more work, terminate worker
        worker.terminate();
      }
    };

    const handleMessage = (worker: Worker) => (e: MessageEvent<WorkerResponse>) => {
      const { nodeId, ids } = e.data;
      
      // Convert string IDs back to bigint
      for (const idStr of ids) {
        results.push({
          id: BigInt(idStr),
          nodeId,
        });
      }

      completedNodes++;
      onProgress?.(completedNodes, nodeCount);

      if (completedNodes === nodeCount) {
        // All done, clean up workers
        workers.forEach(w => w.terminate());
        resolve(results);
      } else {
        // Process next node
        processNext(worker);
      }
    };

    const handleError = (e: ErrorEvent) => {
      workers.forEach(w => w.terminate());
      reject(new Error(`Worker error: ${e.message}`));
    };

    try {
      // Create workers and start processing
      for (let i = 0; i < maxWorkers; i++) {
        const worker = new Worker(workerUrl, { type: 'module' });
        worker.onmessage = handleMessage(worker);
        worker.onerror = handleError;
        workers.push(worker);
        processNext(worker);
      }
    } catch {
      // Worker creation failed, fallback to chunked generation
      console.warn('Web Worker creation failed, using fallback');
      generateIdsChunked(nodeCount, idsPerNode, onProgress).then(resolve).catch(reject);
    }
  });
}

/**
 * Chunked generation (fallback when workers not available)
 * Yields to the event loop periodically to keep UI responsive
 */
export async function generateIdsChunked(
  nodeCount: number,
  idsPerNode: number,
  onProgress?: (completed: number, total: number) => void
): Promise<GeneratedId[]> {
  const results: GeneratedId[] = [];
  
  // Import the regular generator
  const { SnowflakeGenerator } = await import('./snowflake');
  
  const CHUNK_SIZE = 1000; // IDs per chunk before yielding
  
  for (let nodeId = 0; nodeId < nodeCount; nodeId++) {
    const generator = new SnowflakeGenerator(nodeId);
    
    let generated = 0;
    while (generated < idsPerNode) {
      const chunkSize = Math.min(CHUNK_SIZE, idsPerNode - generated);
      
      for (let i = 0; i < chunkSize; i++) {
        results.push({
          id: generator.generate(),
          nodeId,
        });
      }
      
      generated += chunkSize;
      
      // Yield to event loop every chunk
      if (generated < idsPerNode) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    onProgress?.(nodeId + 1, nodeCount);
  }
  
  return results;
}

/**
 * Simple synchronous generation (for small datasets)
 */
export function generateIdsSync(
  nodeCount: number,
  idsPerNode: number
): GeneratedId[] {
  // Inline generation to avoid import overhead
  const EPOCH = 1704067200000n;
  const SEQUENCE_BITS = 12n;
  const NODE_ID_SHIFT = SEQUENCE_BITS;
  const TIMESTAMP_SHIFT = SEQUENCE_BITS + 10n;
  const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n;

  const results: GeneratedId[] = [];

  for (let nodeId = 0; nodeId < nodeCount; nodeId++) {
    const nodeIdBigInt = BigInt(nodeId);
    let sequence = 0n;
    let lastTimestamp = -1n;

    for (let i = 0; i < idsPerNode; i++) {
      let timestamp = BigInt(Date.now());

      if (timestamp === lastTimestamp) {
        sequence = (sequence + 1n) & MAX_SEQUENCE;
        if (sequence === 0n) {
          while (timestamp <= lastTimestamp) {
            timestamp = BigInt(Date.now());
          }
        }
      } else {
        sequence = 0n;
      }

      lastTimestamp = timestamp;

      const id = (
        ((timestamp - EPOCH) << TIMESTAMP_SHIFT) |
        (nodeIdBigInt << NODE_ID_SHIFT) |
        sequence
      );

      results.push({ id, nodeId });
    }
  }

  return results;
}

