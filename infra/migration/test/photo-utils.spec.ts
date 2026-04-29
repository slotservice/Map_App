import { describe, expect, it } from 'vitest';
import {
  contentTypeFor,
  detectImageFormat,
  sha256Hex,
} from '../src/lib/photo-utils.js';

// Synthetic minimal headers (just the magic bytes).
const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const JPEG_HEADER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
const WEBP_HEADER = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP', 'ascii'),
]);
const HEIC_HEADER = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]), // box size
  Buffer.from('ftyp', 'ascii'),
  Buffer.from('heic', 'ascii'),
]);

describe('detectImageFormat', () => {
  it('identifies PNG by magic bytes', () => {
    expect(detectImageFormat(PNG_HEADER)).toBe('png');
  });

  it('identifies JPEG by magic bytes', () => {
    expect(detectImageFormat(JPEG_HEADER)).toBe('jpg');
  });

  it('identifies WEBP by RIFF/WEBP signature', () => {
    expect(detectImageFormat(WEBP_HEADER)).toBe('webp');
  });

  it('identifies HEIC by ftypheic brand', () => {
    expect(detectImageFormat(HEIC_HEADER)).toBe('heic');
  });

  it('returns unknown for short buffers', () => {
    expect(detectImageFormat(Buffer.from([0x89, 0x50]))).toBe('unknown');
  });

  it('returns unknown for unrelated bytes (e.g. PDF)', () => {
    const pdf = Buffer.from('%PDF-1.5\n', 'ascii');
    expect(detectImageFormat(pdf)).toBe('unknown');
  });

  it('does not false-positive RIFF without WEBP', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WAVE', 'ascii'),
    ]);
    expect(detectImageFormat(wav)).toBe('unknown');
  });
});

describe('contentTypeFor', () => {
  it('returns standard content types', () => {
    expect(contentTypeFor('png')).toBe('image/png');
    expect(contentTypeFor('jpg')).toBe('image/jpeg');
    expect(contentTypeFor('webp')).toBe('image/webp');
    expect(contentTypeFor('heic')).toBe('image/heic');
  });

  it('falls back to octet-stream for unknown', () => {
    expect(contentTypeFor('unknown')).toBe('application/octet-stream');
  });
});

describe('sha256Hex', () => {
  it('produces a stable lowercase 64-char hex', () => {
    const a = sha256Hex(Buffer.from('hello'));
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe(sha256Hex(Buffer.from('hello')));
  });

  it('is sensitive to byte differences', () => {
    expect(sha256Hex(Buffer.from('hello'))).not.toBe(sha256Hex(Buffer.from('hellp')));
  });
});
