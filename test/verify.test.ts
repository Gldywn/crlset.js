import { readFileSync } from 'fs';
import { CRL_SET_FIXTURE_PATH } from './utils';
import { CrxFileHeader, verifySignature, unpackCrx } from '../src';

describe('CRX signature Verification', () => {
  let crxBuffer: Buffer;

  beforeAll(async () => {
    crxBuffer = readFileSync(CRL_SET_FIXTURE_PATH);
  });

  it('should return true for a valid signature from a real CRX file', async () => {
    const { header, zipBuffer } = await unpackCrx(crxBuffer);
    await expect(verifySignature(header, zipBuffer)).resolves.toBe(true);
  });

  it('should return false for a valid header with a tampered zip buffer', async () => {
    const { header } = await unpackCrx(crxBuffer);
    const tamperedZipBuffer = Buffer.from('this is not the real zip file');
    await expect(verifySignature(header, tamperedZipBuffer)).resolves.toBe(false);
  });

  it('should return false for a header with corrupted signedHeaderData', async () => {
    const { header, zipBuffer } = await unpackCrx(crxBuffer);
    const corruptedHeader = { ...header, signedHeaderData: 'bm90IGEgdmFsaWQgYnVmZmVy' } as CrxFileHeader;

    await expect(verifySignature(corruptedHeader, zipBuffer)).resolves.toBe(false);
  });

  it('should throw an error if signedHeaderData is missing', async () => {
    const { zipBuffer } = await unpackCrx(crxBuffer);
    const incompleteHeader = {} as CrxFileHeader;

    await expect(verifySignature(incompleteHeader, zipBuffer)).rejects.toThrow(
      'CRX signature verification failed: signedHeaderData is missing.',
    );
  });

  it('should throw an error if no valid public key is found', async () => {
    const { header, zipBuffer } = await unpackCrx(crxBuffer);
    header.sha256WithRsa = [];
    header.sha256WithEcdsa = [];
    await expect(verifySignature(header, zipBuffer)).rejects.toThrow(
      'CRX signature verification failed: no valid publicKey for the CRLSet component found.',
    );
  });
});
