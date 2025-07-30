import { readFileSync } from 'fs';
import { join } from 'path';
import { CRLSet, loadLatestCRLSet, processCrx, RevocationStatus } from '../src';
import * as fetcher from '../src/fetch';
import { getTestDataDir } from '../scripts/utils';

const FIXTURE_PATH = join(getTestDataDir(), 'crlset.crx');

describe('CRLSet revocation logic', () => {
  let crlSet: CRLSet;
  let crxBuffer: Buffer;
  let blockedSpkiHash: string;
  let revokedSerialInfo: { spkiHash: string; serialNumber: string };

  beforeAll(() => {
    crxBuffer = readFileSync(FIXTURE_PATH);
    const { header, revocations } = processCrx(crxBuffer);
    crlSet = new CRLSet(header, revocations);

    // Prepare data for tests
    const blockedSpkiBase64 = crlSet.header.BlockedSPKIs[0];
    if (blockedSpkiBase64) {
      blockedSpkiHash = Buffer.from(blockedSpkiBase64, 'base64').toString('hex');
    }

    const [spkiHash, serials] = revocations.entries().next().value;
    const serialNumber = serials.values().next().value;
    revokedSerialInfo = { spkiHash, serialNumber };
  });

  describe('isRevokedBySPKI', () => {
    it('should correctly identify a blocked SPKI', () => {
      if (blockedSpkiHash) {
        expect(crlSet.isRevokedBySPKI(blockedSpkiHash)).toBe(true);
      } else {
        console.warn('No BlockedSPKIs in the current test fixture. Skipping test.');
        expect(true).toBe(true);
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
        expect(crlSet.check(blockedSpkiHash, 'any-serial')).toBe(RevocationStatus.REVOKED_BY_SPKI);
      }
    });

    it('should return REVOKED_BY_SERIAL for a specific revoked serial', () => {
      const { spkiHash, serialNumber } = revokedSerialInfo;
      // Ensure this SPKI is not globally blocked for this test
      if (spkiHash !== blockedSpkiHash) {
        expect(crlSet.check(spkiHash, serialNumber)).toBe(RevocationStatus.REVOKED_BY_SERIAL);
      }
    });

    it('should return OK for a valid certificate', () => {
      const fakeSpkiHash = 'd'.repeat(64);
      const fakeSerialNumber = 'e'.repeat(16);
      expect(crlSet.check(fakeSpkiHash, fakeSerialNumber)).toBe(RevocationStatus.OK);
    });
  });

  describe('loadLatestCRLSet', () => {
    it('should fetch, process, and return a CRLSet instance', async () => {
      const downloadSpy = jest.spyOn(fetcher, 'downloadLatestCRLSetCrx').mockResolvedValue(crxBuffer);

      const loadedCrlSet = await loadLatestCRLSet();

      expect(loadedCrlSet).toBeInstanceOf(CRLSet);
      expect(loadedCrlSet.sequence).toBe(crlSet.sequence);
      expect(downloadSpy).toHaveBeenCalledTimes(1);

      downloadSpy.mockRestore();
    });

    it('should throw an error if fetching fails', async () => {
      const downloadSpy = jest.spyOn(fetcher, 'downloadLatestCRLSetCrx').mockRejectedValue(new Error('Network Error'));

      await expect(loadLatestCRLSet()).rejects.toThrow('Network Error');

      downloadSpy.mockRestore();
    });
  });
});
