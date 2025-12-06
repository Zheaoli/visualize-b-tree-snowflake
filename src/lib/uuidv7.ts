/**
 * UUIDv7 Generator
 * 
 * UUIDv7 structure (128 bits):
 * - 48 bits: Unix timestamp in milliseconds
 * - 4 bits: version (0111 = 7)
 * - 12 bits: random_a (or counter)
 * - 2 bits: variant (10)
 * - 62 bits: random_b (we use: 10 bits device ID + 52 bits random)
 * 
 * Format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
 * where x is hex digit based on timestamp/random, y is 8, 9, a, or b
 */

const MAX_DEVICE_ID = 1023; // 10 bits

export interface UUIDv7Components {
  timestamp: bigint;
  version: number;
  deviceId: number;
  sequence: number;
}

export class UUIDv7Generator {
  private deviceId: number;
  private sequence: number = 0;
  private lastTimestamp: number = -1;

  constructor(deviceId: number) {
    if (deviceId < 0 || deviceId > MAX_DEVICE_ID) {
      throw new Error(`Device ID must be between 0 and ${MAX_DEVICE_ID}`);
    }
    this.deviceId = deviceId;
  }

  /**
   * Generate a UUIDv7 as a hex string
   */
  generate(): string {
    let timestamp = Date.now();

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1) & 0xFFF; // 12 bits
      if (this.sequence === 0) {
        // Wait for next millisecond
        while (timestamp <= this.lastTimestamp) {
          timestamp = Date.now();
        }
      }
    } else {
      this.sequence = Math.floor(Math.random() * 0x100); // Start with small random
    }

    this.lastTimestamp = timestamp;

    // Build UUID bytes
    // Bytes 0-5: timestamp (48 bits, big-endian)
    // Byte 6: version (4 bits) + random_a high (4 bits)
    // Byte 7: random_a low (8 bits) - we use sequence
    // Byte 8: variant (2 bits) + device_id high (6 bits)
    // Byte 9: device_id low (4 bits) + random (4 bits)
    // Bytes 10-15: random (48 bits)

    const bytes = new Uint8Array(16);

    // Timestamp (48 bits)
    bytes[0] = (timestamp / 0x10000000000) & 0xFF;
    bytes[1] = (timestamp / 0x100000000) & 0xFF;
    bytes[2] = (timestamp / 0x1000000) & 0xFF;
    bytes[3] = (timestamp / 0x10000) & 0xFF;
    bytes[4] = (timestamp / 0x100) & 0xFF;
    bytes[5] = timestamp & 0xFF;

    // Version (7) + sequence high 4 bits
    bytes[6] = 0x70 | ((this.sequence >> 8) & 0x0F);

    // Sequence low 8 bits
    bytes[7] = this.sequence & 0xFF;

    // Variant (10) + device ID high 6 bits
    bytes[8] = 0x80 | ((this.deviceId >> 4) & 0x3F);

    // Device ID low 4 bits + random 4 bits
    bytes[9] = ((this.deviceId & 0x0F) << 4) | (Math.random() * 16 | 0);

    // Random bytes 10-15
    for (let i = 10; i < 16; i++) {
      bytes[i] = Math.random() * 256 | 0;
    }

    return bytesToUUID(bytes);
  }

  /**
   * Generate batch of UUIDs
   */
  generateBatch(count: number): string[] {
    const uuids: string[] = [];
    for (let i = 0; i < count; i++) {
      uuids.push(this.generate());
    }
    return uuids;
  }

  /**
   * Parse UUIDv7 components
   */
  static parse(uuid: string): UUIDv7Components {
    const hex = uuid.replace(/-/g, '');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }

    // Extract timestamp (48 bits)
    const timestamp = BigInt(bytes[0]) * 0x10000000000n +
      BigInt(bytes[1]) * 0x100000000n +
      BigInt(bytes[2]) * 0x1000000n +
      BigInt(bytes[3]) * 0x10000n +
      BigInt(bytes[4]) * 0x100n +
      BigInt(bytes[5]);

    // Version
    const version = (bytes[6] >> 4) & 0x0F;

    // Sequence (12 bits from bytes 6-7)
    const sequence = ((bytes[6] & 0x0F) << 8) | bytes[7];

    // Device ID (10 bits from bytes 8-9)
    const deviceId = ((bytes[8] & 0x3F) << 4) | ((bytes[9] >> 4) & 0x0F);

    return {
      timestamp,
      version,
      deviceId,
      sequence,
    };
  }

  /**
   * Get device ID from UUID
   */
  static getDeviceId(uuid: string): number {
    const hex = uuid.replace(/-/g, '');
    const byte8 = parseInt(hex.substr(16, 2), 16);
    const byte9 = parseInt(hex.substr(18, 2), 16);
    return ((byte8 & 0x3F) << 4) | ((byte9 >> 4) & 0x0F);
  }

  /**
   * Convert UUID to BigInt for B+ Tree sorting
   * Uses first 64 bits (timestamp + version + sequence)
   */
  static toBigInt(uuid: string): bigint {
    const hex = uuid.replace(/-/g, '');
    return BigInt('0x' + hex.substring(0, 16));
  }

  /**
   * Convert UUID to sortable key (full 128 bits as two bigints)
   */
  static toSortKey(uuid: string): { high: bigint; low: bigint } {
    const hex = uuid.replace(/-/g, '');
    return {
      high: BigInt('0x' + hex.substring(0, 16)),
      low: BigInt('0x' + hex.substring(16, 32)),
    };
  }
}

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

/**
 * Manager for multi-device UUIDv7 generation
 */
export class MultiDeviceUUIDv7Manager {
  private generators: Map<number, UUIDv7Generator> = new Map();

  getGenerator(deviceId: number): UUIDv7Generator {
    if (!this.generators.has(deviceId)) {
      this.generators.set(deviceId, new UUIDv7Generator(deviceId));
    }
    return this.generators.get(deviceId)!;
  }

  generateForDevices(
    deviceCount: number,
    uuidsPerDevice: number
  ): { uuid: string; deviceId: number }[] {
    const results: { uuid: string; deviceId: number }[] = [];

    for (let deviceId = 0; deviceId < deviceCount; deviceId++) {
      const generator = this.getGenerator(deviceId);
      const uuids = generator.generateBatch(uuidsPerDevice);
      
      for (const uuid of uuids) {
        results.push({ uuid, deviceId });
      }
    }

    return results;
  }

  clear(): void {
    this.generators.clear();
  }
}

