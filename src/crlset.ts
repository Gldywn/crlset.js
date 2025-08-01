import { CRLSetHeader, RevocationStatus } from './interfaces.js';

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
