/**
 * Snowflake ID Generator Web Worker
 * Runs in a separate thread for parallel ID generation
 */

// Epoch timestamp (2024-01-01 00:00:00 UTC)
const EPOCH = 1704067200000n;

// Bit lengths for each component
const NODE_ID_BITS = 10n;
const SEQUENCE_BITS = 12n;

// Maximum values
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n; // 4095

// Bit shifts
const NODE_ID_SHIFT = SEQUENCE_BITS;
const TIMESTAMP_SHIFT = SEQUENCE_BITS + NODE_ID_BITS;

interface WorkerMessage {
  type: 'generate';
  nodeId: number;
  count: number;
}

interface WorkerResponse {
  type: 'result';
  nodeId: number;
  ids: string[]; // bigint as string for transfer
}

let sequence = 0n;
let lastTimestamp = -1n;

function currentTimestamp(): bigint {
  return BigInt(Date.now());
}

function generate(nodeId: number): bigint {
  const nodeIdBigInt = BigInt(nodeId);
  let timestamp = currentTimestamp();

  if (timestamp === lastTimestamp) {
    sequence = (sequence + 1n) & MAX_SEQUENCE;
    if (sequence === 0n) {
      // Wait for next millisecond
      while (timestamp <= lastTimestamp) {
        timestamp = currentTimestamp();
      }
    }
  } else {
    sequence = 0n;
  }

  lastTimestamp = timestamp;

  return (
    ((timestamp - EPOCH) << TIMESTAMP_SHIFT) |
    (nodeIdBigInt << NODE_ID_SHIFT) |
    sequence
  );
}

function generateBatch(nodeId: number, count: number): string[] {
  // Reset state for each node
  sequence = 0n;
  lastTimestamp = -1n;
  
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(generate(nodeId).toString());
  }
  return ids;
}

// Worker message handler
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, nodeId, count } = e.data;
  
  if (type === 'generate') {
    const ids = generateBatch(nodeId, count);
    const response: WorkerResponse = {
      type: 'result',
      nodeId,
      ids,
    };
    self.postMessage(response);
  }
};

