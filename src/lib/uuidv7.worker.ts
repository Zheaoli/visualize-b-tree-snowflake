/**
 * UUIDv7 Generator Web Worker
 */

const MAX_DEVICE_ID = 1023;

interface WorkerMessage {
  type: 'generate';
  deviceId: number;
  count: number;
}

interface WorkerResponse {
  type: 'result';
  deviceId: number;
  uuids: string[];
}

let sequence = 0;
let lastTimestamp = -1;

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

function generate(deviceId: number): string {
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

  // Timestamp (48 bits)
  bytes[0] = (timestamp / 0x10000000000) & 0xFF;
  bytes[1] = (timestamp / 0x100000000) & 0xFF;
  bytes[2] = (timestamp / 0x1000000) & 0xFF;
  bytes[3] = (timestamp / 0x10000) & 0xFF;
  bytes[4] = (timestamp / 0x100) & 0xFF;
  bytes[5] = timestamp & 0xFF;

  // Version (7) + sequence high
  bytes[6] = 0x70 | ((sequence >> 8) & 0x0F);
  bytes[7] = sequence & 0xFF;

  // Variant (10) + device ID
  bytes[8] = 0x80 | ((deviceId >> 4) & 0x3F);
  bytes[9] = ((deviceId & 0x0F) << 4) | (Math.random() * 16 | 0);

  // Random
  for (let i = 10; i < 16; i++) {
    bytes[i] = Math.random() * 256 | 0;
  }

  return bytesToUUID(bytes);
}

function generateBatch(deviceId: number, count: number): string[] {
  sequence = 0;
  lastTimestamp = -1;
  
  const uuids: string[] = [];
  for (let i = 0; i < count; i++) {
    uuids.push(generate(deviceId));
  }
  return uuids;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, deviceId, count } = e.data;
  
  if (type === 'generate') {
    const uuids = generateBatch(deviceId, count);
    const response: WorkerResponse = {
      type: 'result',
      deviceId,
      uuids,
    };
    self.postMessage(response);
  }
};

