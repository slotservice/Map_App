import { createHash } from 'node:crypto';

export type DetectedFormat = 'png' | 'jpg' | 'webp' | 'heic' | 'unknown';

/**
 * Sniff magic bytes. The legacy server stored photo files with NO
 * extension (filename pattern `image-<task>-<i>-<slot>-<date>`), so
 * during migration we have to peek at the bytes to know what we're
 * uploading.
 */
export function detectImageFormat(buffer: Buffer): DetectedFormat {
  if (buffer.length < 12) return 'unknown';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  // WEBP: RIFF…WEBP
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  // HEIC: ftypheic / ftypheix / ftypmif1 etc., starts at byte 4
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (['heic', 'heix', 'mif1', 'msf1'].includes(brand)) return 'heic';
  }
  return 'unknown';
}

export function contentTypeFor(format: DetectedFormat): string {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'jpg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
