import { readFileSync } from 'fs';
import { CRL_SET_FIXTURE_PATH } from './utils';
import { processCrx, parseCRLSet } from '../src';

describe('CRLSet parsing', () => {
  let crxBuffer: Buffer;

  beforeAll(() => {
    crxBuffer = readFileSync(CRL_SET_FIXTURE_PATH);
  });

  it('should process a valid CRX file without errors', async () => {
    await expect(processCrx(crxBuffer, { verifySignature: true })).resolves.not.toThrow();
  });

  it('should return a valid header and revocations map', async () => {
    const { header, revocations } = await processCrx(crxBuffer, {
      verifySignature: true,
    });

    // Check header properties
    expect(header).toBeDefined();
    expect(typeof header.Sequence).toBe('number');
    expect(typeof header.NumParents).toBe('number');
    expect(Array.isArray(header.BlockedSPKIs)).toBe(true);

    // Check revocations map
    expect(revocations).toBeInstanceOf(Map);
    expect(revocations.size).toBe(header.NumParents);

    // Check a sample revocation entry
    for (const [spkiHash, serials] of revocations.entries()) {
      expect(typeof spkiHash).toBe('string');
      expect(spkiHash).toHaveLength(64); // SHA-256 hex
      expect(serials).toBeInstanceOf(Set);
      break; // Just check the first one
    }
  });

  it('should throw an error for an invalid magic number', async () => {
    const invalidBuffer = Buffer.from(crxBuffer);
    invalidBuffer.write('Fail', 0, 4, 'ascii');
    await expect(processCrx(invalidBuffer, { verifySignature: true })).rejects.toThrow(
      'Invalid CRX magic: expected Cr24, got Fail',
    );
  });

  it('should throw an error for an unsupported version', async () => {
    const invalidBuffer = Buffer.from(crxBuffer);
    invalidBuffer.writeUInt32LE(2, 4); // Set version to 2
    await expect(processCrx(invalidBuffer, { verifySignature: true })).rejects.toThrow(
      'Unsupported CRX version: expected 3, got 2',
    );
  });

  it('should throw an error on a truncated file (at header length)', () => {
    const truncatedBuffer = Buffer.from([0xff]); // Just one byte
    expect(() => parseCRLSet(truncatedBuffer)).toThrow('CRLSet file is truncated (at header length).');
  });

  it('should throw an error on a truncated file (at header content)', () => {
    const truncatedBuffer = Buffer.from([0xff, 0xff]); // Header length is 65535, but no content
    expect(() => parseCRLSet(truncatedBuffer)).toThrow('CRLSet file is truncated (at header content).');
  });

  it('should throw an error on a truncated file (at spki hash)', () => {
    const header = { NumParents: 1 };
    const headerJson = JSON.stringify(header);
    const headerLen = Buffer.byteLength(headerJson);

    const buffer = Buffer.alloc(2 + headerLen + 31); // 31 bytes instead of 32 for spki
    buffer.writeUInt16LE(headerLen, 0);
    buffer.write(headerJson, 2);

    expect(() => parseCRLSet(buffer)).toThrow('CRLSet file is truncated (at SPKI hash).');
  });
});
