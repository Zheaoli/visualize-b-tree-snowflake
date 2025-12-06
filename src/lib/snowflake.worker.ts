/**
 * Snowflake ID Generator Web Worker
 * Runs in a separate thread for parallel ID generation
 */

// Epoch timestamp (2024-01-01 00:00:00 UTC)
const SNOWFLAKE_EPOCH = 1704067200000n;

// Bit lengths for each component
const SNOWFLAKE_NODE_ID_BITS = 10n;
const SNOWFLAKE_SEQUENCE_BITS = 12n;

// Maximum values
const SNOWFLAKE_MAX_SEQUENCE = (1n << SNOWFLAKE_SEQUENCE_BITS) - 1n; // 4095

// Bit shifts
const SNOWFLAKE_NODE_ID_SHIFT = SNOWFLAKE_SEQUENCE_BITS;
const SNOWFLAKE_TIMESTAMP_SHIFT = SNOWFLAKE_SEQUENCE_BITS + SNOWFLAKE_NODE_ID_BITS;

interface SnowflakeWorkerMessage {
  type: 'generate';
  nodeId: number;
  count: number;
}

interface SnowflakeWorkerResponse {
  type: 'result';
  nodeId: number;
  ids: string[];
}

let snowflakeSequence = 0n;
let snowflakeLastTimestamp = -1n;

function snowflakeCurrentTimestamp(): bigint {
  return BigInt(Date.now());
}

function generateSnowflake(nodeId: number): bigint {
  const nodeIdBigInt = BigInt(nodeId);
  let timestamp = snowflakeCurrentTimestamp();

  if (timestamp === snowflakeLastTimestamp) {
    snowflakeSequence = (snowflakeSequence + 1n) & SNOWFLAKE_MAX_SEQUENCE;
    if (snowflakeSequence === 0n) {
      // Wait for next millisecond
      while (timestamp <= snowflakeLastTimestamp) {
        timestamp = snowflakeCurrentTimestamp();
      }
    }
  } else {
    snowflakeSequence = 0n;
  }

  snowflakeLastTimestamp = timestamp;

  return (
    ((timestamp - SNOWFLAKE_EPOCH) << SNOWFLAKE_TIMESTAMP_SHIFT) |
    (nodeIdBigInt << SNOWFLAKE_NODE_ID_SHIFT) |
    snowflakeSequence
  );
}

function generateSnowflakeBatch(nodeId: number, count: number): string[] {
  // Reset state for each node
  snowflakeSequence = 0n;
  snowflakeLastTimestamp = -1n;
  
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(generateSnowflake(nodeId).toString());
  }
  return ids;
}

// Worker message handler
self.onmessage = (e: MessageEvent<SnowflakeWorkerMessage>) => {
  const { type, nodeId, count } = e.data;
  
  if (type === 'generate') {
    const ids = generateSnowflakeBatch(nodeId, count);
    const response: SnowflakeWorkerResponse = {
      type: 'result',
      nodeId,
      ids,
    };
    self.postMessage(response);
  }
};

export {};
