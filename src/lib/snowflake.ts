/**
 * Snowflake ID Generator
 * 
 * Snowflake ID 结构 (64 bits):
 * - 1 bit:  符号位 (始终为 0)
 * - 41 bits: 时间戳 (毫秒级，可用约 69 年)
 * - 10 bits: 节点 ID (最多 1024 个节点)
 * - 12 bits: 序列号 (每毫秒最多 4096 个 ID)
 */

// 起始时间戳 (2024-01-01 00:00:00 UTC)
const EPOCH = 1704067200000n;

// 各部分的位数
const NODE_ID_BITS = 10n;
const SEQUENCE_BITS = 12n;

// 最大值
const MAX_NODE_ID = (1n << NODE_ID_BITS) - 1n; // 1023
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n; // 4095

// 位移量
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
   * 生成下一个 Snowflake ID
   */
  generate(): bigint {
    let timestamp = this.currentTimestamp();

    if (timestamp < this.lastTimestamp) {
      throw new Error('Clock moved backwards. Refusing to generate ID.');
    }

    if (timestamp === this.lastTimestamp) {
      // 同一毫秒内，递增序列号
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;
      if (this.sequence === 0n) {
        // 序列号溢出，等待下一毫秒
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      // 新的毫秒，重置序列号
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    // 组装 Snowflake ID
    const id = 
      ((timestamp - EPOCH) << TIMESTAMP_SHIFT) |
      (this.nodeId << NODE_ID_SHIFT) |
      this.sequence;

    return id;
  }

  /**
   * 批量生成 ID
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
   * 解析 Snowflake ID 的各个组成部分
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
   * 获取 ID 中的时间戳部分（用于可视化分布）
   */
  static getTimestampPart(id: bigint): bigint {
    return id >> TIMESTAMP_SHIFT;
  }

  /**
   * 获取 ID 中的节点 ID 部分
   */
  static getNodeIdPart(id: bigint): number {
    return Number((id >> NODE_ID_SHIFT) & MAX_NODE_ID);
  }
}

/**
 * 用于模拟多节点生成 ID 的管理器
 */
export class MultiNodeSnowflakeManager {
  private generators: Map<number, SnowflakeGenerator> = new Map();

  /**
   * 获取或创建指定节点的生成器
   */
  getGenerator(nodeId: number): SnowflakeGenerator {
    if (!this.generators.has(nodeId)) {
      this.generators.set(nodeId, new SnowflakeGenerator(nodeId));
    }
    return this.generators.get(nodeId)!;
  }

  /**
   * 为多个节点生成 ID
   * @param nodeCount 节点数量
   * @param idsPerNode 每个节点生成的 ID 数量
   * @returns 所有生成的 ID 及其节点信息
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
   * 清除所有生成器
   */
  clear(): void {
    this.generators.clear();
  }
}

