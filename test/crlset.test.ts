import { jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { CRL_SET_FIXTURE_PATH } from './utils';
import type * as CRLSetModuleType from '../src';
import { processCrx } from '../src/parser.js';

const downloadLatestCRLSetCrxMock = jest.fn<typeof CRLSetModuleType.downloadLatestCRLSetCrx>();
const fetchCrxUrlMock = jest.fn<typeof CRLSetModuleType.fetchCrxUrl>();
const fetchRemoteHeaderMock = jest.fn<() => Promise<CRLSetModuleType.CRLSetHeader>>();

jest.unstable_mockModule('../src/fetch.js', () => ({
  downloadLatestCRLSetCrx: downloadLatestCRLSetCrxMock,
  fetchCrxUrl: fetchCrxUrlMock,
  fetchRemoteHeader: fetchRemoteHeaderMock,
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
    const { header, revocations } = await crlsetModule.processCrx(crxBuffer, true);
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

describe('CRLSet caching logic', () => {
  let crxBuffer: Buffer;
  let crlsetModule: typeof CRLSetModuleType;

  beforeAll(async () => {
    crxBuffer = readFileSync(CRL_SET_FIXTURE_PATH);
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.resetModules();
    crlsetModule = await import('../src');
    downloadLatestCRLSetCrxMock.mockClear();
    fetchRemoteHeaderMock.mockClear();
  });

  it('should use cached CRLSet with "on-expiry" strategy if not expired', async () => {
    downloadLatestCRLSetCrxMock.mockResolvedValue(crxBuffer);
    const { header } = await processCrx(crxBuffer, false);
    jest.setSystemTime(new Date((header.NotAfter - 1000) * 1000));

    // First call, should fetch and cache
    await crlsetModule.loadLatestCRLSet({ updateStrategy: 'on-expiry', verifySignature: false });
    expect(downloadLatestCRLSetCrxMock).toHaveBeenCalledTimes(1);

    // Second call, should use cache
    await crlsetModule.loadLatestCRLSet({ updateStrategy: 'on-expiry', verifySignature: false });
    expect(downloadLatestCRLSetCrxMock).toHaveBeenCalledTimes(1);
    expect(fetchRemoteHeaderMock).not.toHaveBeenCalled();
  });

  it('should fetch a new CRLSet with "on-expiry" strategy if cached one is expired', async () => {
    downloadLatestCRLSetCrxMock.mockResolvedValue(crxBuffer);
    const { header } = await processCrx(crxBuffer, false);

    // First call, should fetch and cache
    await crlsetModule.loadLatestCRLSet({ updateStrategy: 'on-expiry', verifySignature: false });
    expect(downloadLatestCRLSetCrxMock).toHaveBeenCalledTimes(1);

    // Second call, should detect expiry and fetch again
    jest.setSystemTime(new Date((header.NotAfter + 1000) * 1000));
    await crlsetModule.loadLatestCRLSet({ updateStrategy: 'on-expiry', verifySignature: false });
    expect(downloadLatestCRLSetCrxMock).toHaveBeenCalledTimes(2);
  });

  it('should check for a new version with "always" strategy', async () => {
    downloadLatestCRLSetCrxMock.mockResolvedValue(crxBuffer);
    const { header } = await processCrx(crxBuffer, false);
    jest.setSystemTime(new Date((header.NotAfter - 1000) * 1000)); // Not expired
    fetchRemoteHeaderMock.mockResolvedValue({ ...header, Sequence: header.Sequence + 1 });

    await crlsetModule.loadLatestCRLSet({ updateStrategy: 'always', verifySignature: false });
    expect(downloadLatestCRLSetCrxMock).toHaveBeenCalledTimes(1);

    await crlsetModule.loadLatestCRLSet({ updateStrategy: 'always', verifySignature: false });
    expect(downloadLatestCRLSetCrxMock).toHaveBeenCalledTimes(2);
    expect(fetchRemoteHeaderMock).toHaveBeenCalledTimes(1);
  });

  it('should not fetch a new version with "always" strategy if sequence is not higher', async () => {
    downloadLatestCRLSetCrxMock.mockResolvedValue(crxBuffer);
    const { header } = await processCrx(crxBuffer, false);
    jest.setSystemTime(new Date((header.NotAfter - 1000) * 1000)); // Not expired
    fetchRemoteHeaderMock.mockResolvedValue(header);

    await crlsetModule.loadLatestCRLSet({ updateStrategy: 'always', verifySignature: false });
    expect(downloadLatestCRLSetCrxMock).toHaveBeenCalledTimes(1);

    await crlsetModule.loadLatestCRLSet({ updateStrategy: 'always', verifySignature: false });
    expect(downloadLatestCRLSetCrxMock).toHaveBeenCalledTimes(1);
    expect(fetchRemoteHeaderMock).toHaveBeenCalledTimes(1);
  });
});
