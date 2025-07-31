import { jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { CRL_SET_FIXTURE_PATH } from './utils';
import type * as CRLSetModuleType from '../src';

const downloadLatestCRLSetCrxMock = jest.fn<typeof CRLSetModuleType.downloadLatestCRLSetCrx>();

jest.unstable_mockModule('../src/fetch.js', () => ({
  downloadLatestCRLSetCrx: downloadLatestCRLSetCrxMock,
}));

describe('CRLSet revocation logic', () => {
  let crlSet: CRLSetModuleType.CRLSet;
  let crxBuffer: Buffer;
  let blockedSpkiHash: string;
  let revokedSerialInfo: { spkiHash: string; serialNumber: string };

  let crlsetModule: typeof CRLSetModuleType;

  beforeAll(async () => {
    crlsetModule = await import('../src');

    crxBuffer = readFileSync(CRL_SET_FIXTURE_PATH);
    const { header, revocations } = await crlsetModule.processCrx(crxBuffer, {
      verifySignature: true,
    });
    crlSet = new crlsetModule.CRLSet(header, revocations);

    const blockedSpkiBase64 = crlSet.header.BlockedSPKIs[0];
    if (blockedSpkiBase64) {
      blockedSpkiHash = Buffer.from(blockedSpkiBase64, 'base64').toString('hex');
    }

    const [spkiHash, serials] = revocations.entries().next().value;
    const serialNumber = serials.values().next().value;
    revokedSerialInfo = { spkiHash, serialNumber };
  });

  afterEach(() => {
    downloadLatestCRLSetCrxMock.mockClear();
  });

  describe('isRevokedBySPKI', () => {
    it('should correctly identify a blocked SPKI', () => {
      if (blockedSpkiHash) {
        expect(crlSet.isRevokedBySPKI(blockedSpkiHash)).toBe(true);
      } else {
        console.warn('No BlockedSPKIs in the current test fixture. Skipping test.');
        expect(false).toBe(true);
      }
    });

    it('should return false for an SPKI that is not blocked', () => {
      const fakeSpkiHash = 'a'.repeat(64);
      expect(crlSet.isRevokedBySPKI(fakeSpkiHash)).toBe(false);
    });
  });

  describe('isRevokedBySerial', () => {
    it('should correctly identify a revoked certificate by SPKI and serial', () => {
      const { spkiHash, serialNumber } = revokedSerialInfo;
      expect(crlSet.isRevokedBySerial(spkiHash, serialNumber)).toBe(true);
    });

    it('should return false for a certificate that is not revoked', () => {
      const { spkiHash } = revokedSerialInfo;
      const fakeSerialNumber = 'a'.repeat(16);
      expect(crlSet.isRevokedBySerial(spkiHash, fakeSerialNumber)).toBe(false);
    });

    it('should return false for a CA that is not in the revocation list', () => {
      const fakeSpkiHash = 'b'.repeat(64);
      const fakeSerialNumber = 'c'.repeat(16);
      expect(crlSet.isRevokedBySerial(fakeSpkiHash, fakeSerialNumber)).toBe(false);
    });
  });

  describe('check', () => {
    it('should return REVOKED_BY_SPKI for a blocked CA', () => {
      if (blockedSpkiHash) {
        expect(crlSet.check(blockedSpkiHash, 'any-serial')).toBe(crlsetModule.RevocationStatus.REVOKED_BY_SPKI);
      }
    });

    it('should return REVOKED_BY_SERIAL for a specific revoked serial', () => {
      const { spkiHash, serialNumber } = revokedSerialInfo;
      // Ensure this SPKI is not globally blocked for this test
      if (spkiHash !== blockedSpkiHash) {
        expect(crlSet.check(spkiHash, serialNumber)).toBe(crlsetModule.RevocationStatus.REVOKED_BY_SERIAL);
      }
    });

    it('should return OK for a valid certificate', () => {
      const fakeSpkiHash = 'd'.repeat(64);
      const fakeSerialNumber = 'e'.repeat(16);
      expect(crlSet.check(fakeSpkiHash, fakeSerialNumber)).toBe(crlsetModule.RevocationStatus.OK);
    });
  });

  describe('loadLatestCRLSet', () => {
    it('should fetch, process, and return a CRLSet instance', async () => {
      downloadLatestCRLSetCrxMock.mockResolvedValue(crxBuffer);

      const loadedCrlSet = await crlsetModule.loadLatestCRLSet({ verifySignature: true });

      expect(loadedCrlSet).toBeInstanceOf(crlsetModule.CRLSet);
      expect(loadedCrlSet.sequence).toBe(crlSet.sequence);
      expect(downloadLatestCRLSetCrxMock).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if fetching fails', async () => {
      downloadLatestCRLSetCrxMock.mockRejectedValue(new Error('Network Error'));

      await expect(crlsetModule.loadLatestCRLSet({ verifySignature: true })).rejects.toThrow('Network Error');
    });
  });
});
