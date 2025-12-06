/**
 * Snowflake ID Generator
 * 
 * Snowflake ID structure (64 bits):
 * - 1 bit:  sign bit (always 0)
 * - 41 bits: timestamp (milliseconds, ~69 years)
 * - 10 bits: node ID (up to 1024 nodes)
 * - 12 bits: sequence (up to 4096 IDs per millisecond)
 */

// Epoch timestamp (2024-01-01 00:00:00 UTC)
const EPOCH = 1704067200000n;

// Bit lengths for each component
const NODE_ID_BITS = 10n;
const SEQUENCE_BITS = 12n;

// Maximum values
const MAX_NODE_ID = (1n << NODE_ID_BITS) - 1n; // 1023
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n; // 4095

// Bit shifts
const NODE_ID_SHIFT = SEQUENCE_BITS;
const TIMESTAMP_SHIFT = SEQUENCE_BITS + NODE_ID_BITS;

export interface SnowflakeComponents {
  timestamp: bigint;
  nodeId: bigint;
  sequence: bigint;
  date: Date;
}

export class SnowflakeGenerator {
  private nodeId: bigint;
  private sequence: bigint = 0n;
  private lastTimestamp: bigint = -1n;

  constructor(nodeId: number) {
    if (nodeId < 0 || nodeId > Number(MAX_NODE_ID)) {
      throw new Error(`Node ID must be between 0 and ${MAX_NODE_ID}`);
    }
    this.nodeId = BigInt(nodeId);
  }

  /**
   * Generate next Snowflake ID
   */
  generate(): bigint {
    let timestamp = this.currentTimestamp();

    if (timestamp < this.lastTimestamp) {
      throw new Error('Clock moved backwards. Refusing to generate ID.');
    }

    if (timestamp === this.lastTimestamp) {
      // Same millisecond, increment sequence
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;
      if (this.sequence === 0n) {
        // Sequence overflow, wait for next millisecond
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      // New millisecond, reset sequence
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    // Assemble Snowflake ID
    const id = 
      ((timestamp - EPOCH) << TIMESTAMP_SHIFT) |
      (this.nodeId << NODE_ID_SHIFT) |
      this.sequence;

    return id;
  }

  /**
   * Generate batch of IDs
   */
  generateBatch(count: number): bigint[] {
    const ids: bigint[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.generate());
    }
    return ids;
  }

  private currentTimestamp(): bigint {
    return BigInt(Date.now());
  }

  private waitNextMillis(lastTimestamp: bigint): bigint {
    let timestamp = this.currentTimestamp();
    while (timestamp <= lastTimestamp) {
      timestamp = this.currentTimestamp();
    }
    return timestamp;
  }

  /**
   * Parse Snowflake ID into its components
   */
  static parse(id: bigint): SnowflakeComponents {
    const sequence = id & MAX_SEQUENCE;
    const nodeId = (id >> NODE_ID_SHIFT) & MAX_NODE_ID;
    const timestamp = (id >> TIMESTAMP_SHIFT) + EPOCH;

    return {
      timestamp,
      nodeId,
      sequence,
      date: new Date(Number(timestamp)),
    };
  }

  /**
   * Get timestamp part from ID (for distribution visualization)
   */
  static getTimestampPart(id: bigint): bigint {
    return id >> TIMESTAMP_SHIFT;
  }

  /**
   * Get node ID part from ID
   */
  static getNodeIdPart(id: bigint): number {
    return Number((id >> NODE_ID_SHIFT) & MAX_NODE_ID);
  }
}

/**
 * Manager for simulating multi-node ID generation
 */
export class MultiNodeSnowflakeManager {
  private generators: Map<number, SnowflakeGenerator> = new Map();

  /**
   * Get or create generator for specified node
   */
  getGenerator(nodeId: number): SnowflakeGenerator {
    if (!this.generators.has(nodeId)) {
      this.generators.set(nodeId, new SnowflakeGenerator(nodeId));
    }
    return this.generators.get(nodeId)!;
  }

  /**
   * Generate IDs for multiple nodes
   * @param nodeCount Number of nodes
   * @param idsPerNode Number of IDs to generate per node
   * @returns All generated IDs with their node info
   */
  generateForNodes(
    nodeCount: number,
    idsPerNode: number
  ): { id: bigint; nodeId: number }[] {
    const results: { id: bigint; nodeId: number }[] = [];

    for (let nodeId = 0; nodeId < nodeCount; nodeId++) {
      const generator = this.getGenerator(nodeId);
      const ids = generator.generateBatch(idsPerNode);
      
      for (const id of ids) {
        results.push({ id, nodeId });
      }
    }

    return results;
  }

  /**
   * Clear all generators
   */
  clear(): void {
    this.generators.clear();
  }
}
