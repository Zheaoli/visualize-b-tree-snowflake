/**
 * UUIDv7 Generator Web Worker
 */

interface UUIDv7WorkerMessage {
  type: 'generate';
  deviceId: number;
  count: number;
}

interface UUIDv7WorkerResponse {
  type: 'result';
  deviceId: number;
  uuids: string[];
}

let uuidv7Sequence = 0;
let uuidv7LastTimestamp = -1;

function uuidv7BytesToUUID(bytes: Uint8Array): string {
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

function generateUUIDv7(deviceId: number): string {
  let timestamp = Date.now();

  if (timestamp === uuidv7LastTimestamp) {
    uuidv7Sequence = (uuidv7Sequence + 1) & 0xFFF;
    if (uuidv7Sequence === 0) {
      while (timestamp <= uuidv7LastTimestamp) {
        timestamp = Date.now();
      }
    }
  } else {
    uuidv7Sequence = Math.floor(Math.random() * 0x100);
  }

  uuidv7LastTimestamp = timestamp;

  const bytes = new Uint8Array(16);

  // Timestamp (48 bits)
  bytes[0] = (timestamp / 0x10000000000) & 0xFF;
  bytes[1] = (timestamp / 0x100000000) & 0xFF;
  bytes[2] = (timestamp / 0x1000000) & 0xFF;
  bytes[3] = (timestamp / 0x10000) & 0xFF;
  bytes[4] = (timestamp / 0x100) & 0xFF;
  bytes[5] = timestamp & 0xFF;

  // Version (7) + sequence high
  bytes[6] = 0x70 | ((uuidv7Sequence >> 8) & 0x0F);
  bytes[7] = uuidv7Sequence & 0xFF;

  // Variant (10) + device ID
  bytes[8] = 0x80 | ((deviceId >> 4) & 0x3F);
  bytes[9] = ((deviceId & 0x0F) << 4) | (Math.random() * 16 | 0);

  // Random
  for (let i = 10; i < 16; i++) {
    bytes[i] = Math.random() * 256 | 0;
  }

  return uuidv7BytesToUUID(bytes);
}

function generateUUIDv7Batch(deviceId: number, count: number): string[] {
  uuidv7Sequence = 0;
  uuidv7LastTimestamp = -1;
  
  const uuids: string[] = [];
  for (let i = 0; i < count; i++) {
    uuids.push(generateUUIDv7(deviceId));
  }
  return uuids;
}

self.onmessage = (e: MessageEvent<UUIDv7WorkerMessage>) => {
  const { type, deviceId, count } = e.data;
  
  if (type === 'generate') {
    const uuids = generateUUIDv7Batch(deviceId, count);
    const response: UUIDv7WorkerResponse = {
      type: 'result',
      deviceId,
      uuids,
    };
    self.postMessage(response);
  }
};

export {};
