/**
 * Parallel ID Generator
 * Supports both Snowflake IDs and UUIDv7
 */

import { UUIDv7Generator } from './uuidv7';

export type IdType = 'snowflake' | 'uuidv7';

export interface GeneratedId {
  id: bigint;
  nodeId: number;
  raw?: string; // Original UUID string for UUIDv7
}

interface SnowflakeWorkerResponse {
  type: 'result';
  nodeId: number;
  ids: string[];
}

interface UUIDv7WorkerResponse {
  type: 'result';
  deviceId: number;
  uuids: string[];
}

const supportsWorkers = typeof Worker !== 'undefined';

/**
 * Generate IDs in parallel
 */
export async function generateIdsParallel(
  nodeCount: number,
  idsPerNode: number,
  idType: IdType = 'snowflake',
  onProgress?: (completed: number, total: number) => void
): Promise<GeneratedId[]> {
  if (!supportsWorkers || nodeCount <= 2) {
    return generateIdsChunked(nodeCount, idsPerNode, idType, onProgress);
  }

  if (idType === 'uuidv7') {
    return generateUUIDv7Parallel(nodeCount, idsPerNode, onProgress);
  }

  return generateSnowflakeParallel(nodeCount, idsPerNode, onProgress);
}

/**
 * Parallel Snowflake generation using Web Workers
 */
async function generateSnowflakeParallel(
  nodeCount: number,
  idsPerNode: number,
  onProgress?: (completed: number, total: number) => void
): Promise<GeneratedId[]> {
  return new Promise((resolve, reject) => {
    const results: GeneratedId[] = [];
    let completedNodes = 0;
    const workers: Worker[] = [];

    const maxWorkers = Math.min(
      navigator.hardwareConcurrency || 4,
      nodeCount,
      8
    );

    const workerUrl = new URL('./snowflake.worker.ts', import.meta.url);
    const nodeQueue: number[] = Array.from({ length: nodeCount }, (_, i) => i);

    const processNext = (worker: Worker) => {
      const nodeId = nodeQueue.shift();
      if (nodeId !== undefined) {
        worker.postMessage({ type: 'generate', nodeId, count: idsPerNode });
      } else {
        worker.terminate();
      }
    };

    const handleMessage = (worker: Worker) => (e: MessageEvent<SnowflakeWorkerResponse>) => {
      const { nodeId, ids } = e.data;
      
      for (const idStr of ids) {
        results.push({ id: BigInt(idStr), nodeId });
      }

      completedNodes++;
      onProgress?.(completedNodes, nodeCount);

      if (completedNodes === nodeCount) {
        workers.forEach(w => w.terminate());
        resolve(results);
      } else {
        processNext(worker);
      }
    };

    const handleError = (e: ErrorEvent) => {
      workers.forEach(w => w.terminate());
      reject(new Error(`Worker error: ${e.message}`));
    };

    try {
      for (let i = 0; i < maxWorkers; i++) {
        const worker = new Worker(workerUrl, { type: 'module' });
        worker.onmessage = handleMessage(worker);
        worker.onerror = handleError;
        workers.push(worker);
        processNext(worker);
      }
    } catch {
      console.warn('Web Worker creation failed, using fallback');
      generateIdsChunked(nodeCount, idsPerNode, 'snowflake', onProgress).then(resolve).catch(reject);
    }
  });
}

/**
 * Parallel UUIDv7 generation using Web Workers
 */
async function generateUUIDv7Parallel(
  deviceCount: number,
  uuidsPerDevice: number,
  onProgress?: (completed: number, total: number) => void
): Promise<GeneratedId[]> {
  return new Promise((resolve, reject) => {
    const results: GeneratedId[] = [];
    let completedDevices = 0;
    const workers: Worker[] = [];

    const maxWorkers = Math.min(
      navigator.hardwareConcurrency || 4,
      deviceCount,
      8
    );

    const workerUrl = new URL('./uuidv7.worker.ts', import.meta.url);
    const deviceQueue: number[] = Array.from({ length: deviceCount }, (_, i) => i);

    const processNext = (worker: Worker) => {
      const deviceId = deviceQueue.shift();
      if (deviceId !== undefined) {
        worker.postMessage({ type: 'generate', deviceId, count: uuidsPerDevice });
      } else {
        worker.terminate();
      }
    };

    const handleMessage = (worker: Worker) => (e: MessageEvent<UUIDv7WorkerResponse>) => {
      const { deviceId, uuids } = e.data;
      
      for (const uuid of uuids) {
        results.push({
          id: UUIDv7Generator.toBigInt(uuid),
          nodeId: deviceId,
          raw: uuid,
        });
      }

      completedDevices++;
      onProgress?.(completedDevices, deviceCount);

      if (completedDevices === deviceCount) {
        workers.forEach(w => w.terminate());
        resolve(results);
      } else {
        processNext(worker);
      }
    };

    const handleError = (e: ErrorEvent) => {
      workers.forEach(w => w.terminate());
      reject(new Error(`Worker error: ${e.message}`));
    };

    try {
      for (let i = 0; i < maxWorkers; i++) {
        const worker = new Worker(workerUrl, { type: 'module' });
        worker.onmessage = handleMessage(worker);
        worker.onerror = handleError;
        workers.push(worker);
        processNext(worker);
      }
    } catch {
      console.warn('Web Worker creation failed, using fallback');
      generateIdsChunked(deviceCount, uuidsPerDevice, 'uuidv7', onProgress).then(resolve).catch(reject);
    }
  });
}

/**
 * Chunked generation (fallback)
 */
export async function generateIdsChunked(
  nodeCount: number,
  idsPerNode: number,
  idType: IdType = 'snowflake',
  onProgress?: (completed: number, total: number) => void
): Promise<GeneratedId[]> {
  const results: GeneratedId[] = [];
  const CHUNK_SIZE = 1000;

  if (idType === 'uuidv7') {
    const { UUIDv7Generator } = await import('./uuidv7');
    
    for (let deviceId = 0; deviceId < nodeCount; deviceId++) {
      const generator = new UUIDv7Generator(deviceId);
      
      let generated = 0;
      while (generated < idsPerNode) {
        const chunkSize = Math.min(CHUNK_SIZE, idsPerNode - generated);
        
        for (let i = 0; i < chunkSize; i++) {
          const uuid = generator.generate();
          results.push({
            id: UUIDv7Generator.toBigInt(uuid),
            nodeId: deviceId,
            raw: uuid,
          });
        }
        
        generated += chunkSize;
        
        if (generated < idsPerNode) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      onProgress?.(deviceId + 1, nodeCount);
    }
  } else {
    const { SnowflakeGenerator } = await import('./snowflake');
    
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
        
        if (generated < idsPerNode) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      onProgress?.(nodeId + 1, nodeCount);
    }
  }
  
  return results;
}

/**
 * Synchronous generation (for small datasets)
 */
export function generateIdsSync(
  nodeCount: number,
  idsPerNode: number,
  idType: IdType = 'snowflake'
): GeneratedId[] {
  if (idType === 'uuidv7') {
    return generateUUIDv7Sync(nodeCount, idsPerNode);
  }
  return generateSnowflakeSync(nodeCount, idsPerNode);
}

function generateSnowflakeSync(nodeCount: number, idsPerNode: number): GeneratedId[] {
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

function generateUUIDv7Sync(deviceCount: number, uuidsPerDevice: number): GeneratedId[] {
  const results: GeneratedId[] = [];

  function bytesToUUID(bytes: Uint8Array): string {
    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32),
    ].join('-');
  }

  function uuidToBigInt(uuid: string): bigint {
    const hex = uuid.replace(/-/g, '');
    return BigInt('0x' + hex.substring(0, 16));
  }

  for (let deviceId = 0; deviceId < deviceCount; deviceId++) {
    let sequence = 0;
    let lastTimestamp = -1;

    for (let i = 0; i < uuidsPerDevice; i++) {
      let timestamp = Date.now();

      if (timestamp === lastTimestamp) {
        sequence = (sequence + 1) & 0xFFF;
        if (sequence === 0) {
          while (timestamp <= lastTimestamp) {
            timestamp = Date.now();
          }
        }
      } else {
        sequence = Math.floor(Math.random() * 0x100);
      }

      lastTimestamp = timestamp;

      const bytes = new Uint8Array(16);
      bytes[0] = (timestamp / 0x10000000000) & 0xFF;
      bytes[1] = (timestamp / 0x100000000) & 0xFF;
      bytes[2] = (timestamp / 0x1000000) & 0xFF;
      bytes[3] = (timestamp / 0x10000) & 0xFF;
      bytes[4] = (timestamp / 0x100) & 0xFF;
      bytes[5] = timestamp & 0xFF;
      bytes[6] = 0x70 | ((sequence >> 8) & 0x0F);
      bytes[7] = sequence & 0xFF;
      bytes[8] = 0x80 | ((deviceId >> 4) & 0x3F);
      bytes[9] = ((deviceId & 0x0F) << 4) | (Math.random() * 16 | 0);
      for (let j = 10; j < 16; j++) {
        bytes[j] = Math.random() * 256 | 0;
      }

      const uuid = bytesToUUID(bytes);
      results.push({
        id: uuidToBigInt(uuid),
        nodeId: deviceId,
        raw: uuid,
      });
    }
  }

  return results;
}
