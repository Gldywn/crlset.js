import { jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { CRL_SET_FIXTURE_PATH } from './utils';
import type * as ParserModuleType from '../src/parser';
import type * as VerifierModuleType from '../src/verify';

const verifySignatureMock = jest.fn<typeof VerifierModuleType.verifySignature>();

jest.unstable_mockModule('../src/verify.js', () => ({
  verifySignature: verifySignatureMock,
}));

describe('CRLSet parsing', () => {
  let crxBuffer: Buffer;
  let parserModule: typeof ParserModuleType;

  beforeAll(async () => {
    parserModule = await import('../src/parser');
    crxBuffer = readFileSync(CRL_SET_FIXTURE_PATH);
  });

  afterEach(() => {
    verifySignatureMock.mockClear();
  });

  it('should process a valid CRX file without errors', async () => {
    verifySignatureMock.mockResolvedValue(true);
    await expect(parserModule.processCrx(crxBuffer, { verifySignature: true })).resolves.not.toThrow();
  });

  it('should return a valid header and revocations map', async () => {
    verifySignatureMock.mockResolvedValue(true);
    const { header, revocations } = await parserModule.processCrx(crxBuffer, {
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
    await expect(parserModule.processCrx(invalidBuffer, { verifySignature: true })).rejects.toThrow(
      'Invalid CRX magic: expected Cr24, got Fail',
    );
  });

  it('should throw an error for an unsupported version', async () => {
    const invalidBuffer = Buffer.from(crxBuffer);
    invalidBuffer.writeUInt32LE(2, 4); // Set version to 2
    await expect(parserModule.processCrx(invalidBuffer, { verifySignature: true })).rejects.toThrow(
      'Unsupported CRX version: expected 3, got 2',
    );
  });

  it('should throw an error for an invalid header length', async () => {
    const invalidBuffer = Buffer.from(crxBuffer);
    invalidBuffer.writeUInt32LE(invalidBuffer.length, 8);
    await expect(parserModule.unpackCrx(invalidBuffer)).rejects.toThrow(
      'Invalid CRX header: header length exceeds file size.',
    );
  });

  it('should throw if CRLSet file is not in the archive', async () => {
    const adm_zip = (await import('adm-zip')).default;
    const zip = new adm_zip();
    zip.addFile('not-crl-set', Buffer.from(''));
    const zipBuffer = zip.toBuffer();

    const crx = Buffer.concat([Buffer.from('Cr24\x03\x00\x00\x00'), Buffer.alloc(4), Buffer.alloc(0), zipBuffer]);
    crx.writeUInt32LE(0, 8);
    await expect(parserModule.processCrx(crx, { verifySignature: false })).rejects.toThrow(
      'CRX archive does not contain a CRLSet file.',
    );
  });

  it('should throw an error on a truncated file (at header length)', () => {
    const truncatedBuffer = Buffer.from([0xff]); // Just one byte
    expect(() => parserModule.parseCRLSet(truncatedBuffer)).toThrow('CRLSet file is truncated (at header length).');
  });

  it('should throw an error on a truncated file (at header content)', () => {
    const truncatedBuffer = Buffer.from([0xff, 0xff]); // Header length is 65535, but no content
    expect(() => parserModule.parseCRLSet(truncatedBuffer)).toThrow('CRLSet file is truncated (at header content).');
  });

  it('should throw an error on a truncated file (at spki hash)', () => {
    const header = { NumParents: 1 };
    const headerJson = JSON.stringify(header);
    const headerLen = Buffer.byteLength(headerJson);

    const buffer = Buffer.alloc(2 + headerLen + 31); // 31 bytes instead of 32 for spki
    buffer.writeUInt16LE(headerLen, 0);
    buffer.write(headerJson, 2);

    expect(() => parserModule.parseCRLSet(buffer)).toThrow('CRLSet file is truncated (at SPKI hash).');
  });

  it('should throw when CRLSet is truncated (at serial count)', () => {
    const header = { NumParents: 1 };
    const headerJson = JSON.stringify(header);
    const headerLen = Buffer.byteLength(headerJson);
    const buffer = Buffer.alloc(2 + headerLen + 32 + 3);
    buffer.writeUInt16LE(headerLen, 0);
    buffer.write(headerJson, 2);
    buffer.fill(0, 2 + headerLen, 2 + headerLen + 32);
    expect(() => parserModule.parseCRLSet(buffer)).toThrow('CRLSet file is truncated (at serial count).');
  });

  it('should throw when CRLSet is truncated (at serial length)', () => {
    const header = { NumParents: 1, NumSerials: 1 };
    const headerJson = JSON.stringify(header);
    const headerLen = Buffer.byteLength(headerJson);
    const buffer = Buffer.alloc(2 + headerLen + 32 + 4);
    buffer.writeUInt16LE(headerLen, 0);
    buffer.write(headerJson, 2);
    buffer.fill(0, 2 + headerLen, 2 + headerLen + 32);
    buffer.writeUInt32LE(1, 2 + headerLen + 32);
    expect(() => parserModule.parseCRLSet(buffer)).toThrow('CRLSet file is truncated (at serial length).');
  });

  it('should throw when CRLSet is truncated (at serial number)', () => {
    const header = { NumParents: 1, NumSerials: 1 };
    const headerJson = JSON.stringify(header);
    const headerLen = Buffer.byteLength(headerJson);
    const buffer = Buffer.alloc(2 + headerLen + 32 + 4 + 1);
    buffer.writeUInt16LE(headerLen, 0);
    buffer.write(headerJson, 2);
    buffer.fill(0, 2 + headerLen, 2 + headerLen + 32);
    buffer.writeUInt32LE(1, 2 + headerLen + 32);
    buffer.writeUInt8(1, 2 + headerLen + 32 + 4);
    expect(() => parserModule.parseCRLSet(buffer)).toThrow('CRLSet file is truncated (at serial number).');
  });

  it('should throw when signature verification fails', async () => {
    verifySignatureMock.mockResolvedValue(false);
    await expect(parserModule.processCrx(crxBuffer, { verifySignature: true })).rejects.toThrow(
      'CRX signature verification failed.',
    );
  });
});
