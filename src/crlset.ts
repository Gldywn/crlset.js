import { downloadLatestCRLSetCrx, fetchRemoteHeader } from './fetch.js';
import { CRLSetHeader, RevocationStatus } from './interfaces.js';
import { processCrx } from './parser.js';

/**
 * Represents a parsed Chrome CRLSet.
 *
 * It holds the revocation data and provides methods to check if a certificate
 * is revoked by its issuer's SPKI hash and/or its serial number.
 */
export class CRLSet {
  public readonly header: CRLSetHeader;
  public readonly sequence: number;
  private readonly revocations: Map<string, Set<string>>;
  private readonly blockedSpkis: Set<string>;

  constructor(header: CRLSetHeader, revocations: Map<string, Set<string>>) {
    this.header = header;
    this.revocations = revocations;
    this.sequence = header.Sequence;
    this.blockedSpkis = new Set(header.BlockedSPKIs.map((spki) => Buffer.from(spki, 'base64').toString('hex')));
  }

  /**
   * Performs a comprehensive revocation check for a certificate.
   * It first checks if the issuer CA is entirely blocked, and if not,
   * then checks for the specific certificate serial number.
   *
   * This is the recommended method for most use cases.
   *
   * @param spkiHash The SHA-256 hash of the issuer CA's SubjectPublicKeyInfo, in hex format.
   * @param serialNumber The serial number of the certificate to check, in hex format.
   * @returns A `RevocationStatus` enum indicating the outcome of the check.
   */
  check(spkiHash: string, serialNumber: string): RevocationStatus {
    if (this.isRevokedBySPKI(spkiHash)) {
      return RevocationStatus.REVOKED_BY_SPKI;
    }
    if (this.isRevokedBySerial(spkiHash, serialNumber)) {
      return RevocationStatus.REVOKED_BY_SERIAL;
    }
    return RevocationStatus.OK;
  }

  /**
   * Checks if a Certificate Authority (CA) is completely blocked.
   *
   * @param spkiHash The SHA-256 hash of the CA's SubjectPublicKeyInfo, in hex format.
   * @returns `true` if all certificates from this CA should be rejected.
   */
  isRevokedBySPKI(spkiHash: string): boolean {
    return this.blockedSpkis.has(spkiHash.toLowerCase());
  }

  /**
   * Checks if a specific certificate has been revoked by its serial number for a given issuer.
   * This is a granular check. For a more general check, use the `check()` method.
   *
   * @param spkiHash The SHA-256 hash of the issuer CA's SubjectPublicKeyInfo, in hex format.
   * @param serialNumber The serial number of the certificate to check, in hex format.
   * @returns `true` if the certificate is listed as revoked for the given issuer.
   */
  isRevokedBySerial(spkiHash: string, serialNumber: string): boolean {
    const serials = this.revocations.get(spkiHash.toLowerCase());
    if (!serials) {
      return false;
    }
    return serials.has(serialNumber.toLowerCase());
  }

  /**
   * Returns the number of revoked certificate entries.
   */
  getRevocationCount(): number {
    /* istanbul ignore next */
    return this.revocations.size;
  }

  /**
   * Returns the number of blocked SPKIs.
   */
  getBlockedSpkiCount(): number {
    /* istanbul ignore next */
    return this.blockedSpkis.size;
  }
}

let cachedCRLSet: CRLSet | null = null;

/**
 * Fetches the latest CRLSet from the Google Omaha proxy, processes it, and
 * returns a CRLSet instance.
 *
 * This function uses an in-memory cache to avoid repeated downloads. The update
 * behavior can be controlled with the `updateStrategy` option.
 *
 * @param options Configuration options for fetching and caching.
 *   - `verifySignature`: If `true`, the signature of the CRLSet is verified. Defaults to `true`.
 *   - `updateStrategy`: Defines when to check for a new CRLSet.
 *     - `'always'`: (Default) Always check for a newer version. If one is found, it's downloaded.
 *     - `'on-expiry'`: Only check for a new version if the cached one has passed its 'NotAfter' date (i.e., has hard-expired). Note that a newer CRLSet may exist even if the cached one has not expired.
 * @returns A new `CRLSet` instance with the latest revocation data.
 */
export async function loadLatestCRLSet(
  options: {
    verifySignature?: boolean;
    updateStrategy?: 'always' | 'on-expiry';
  } = {},
): Promise<CRLSet> {
  const { verifySignature = true, updateStrategy = 'always' } = options;
  const now = Math.floor(Date.now() / 1000);

  const fetchAndProcessNewSet = async () => {
    const crxBuffer = await downloadLatestCRLSetCrx();
    const { header, revocations } = await processCrx(crxBuffer, verifySignature);
    cachedCRLSet = new CRLSet(header, revocations);
    return cachedCRLSet;
  };

  if (!cachedCRLSet) {
    return await fetchAndProcessNewSet();
  }

  const isExpired = cachedCRLSet.header.NotAfter < now;

  if (isExpired) {
    return await fetchAndProcessNewSet();
  }

  if (updateStrategy === 'on-expiry') {
    return cachedCRLSet;
  }

  // Fallback to 'always' strategy
  const remoteHeader = await fetchRemoteHeader();
  if (remoteHeader.Sequence > cachedCRLSet.header.Sequence) {
    return await fetchAndProcessNewSet();
  }

  return cachedCRLSet;
}
