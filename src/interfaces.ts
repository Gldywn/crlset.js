export interface OmahaResponse {
  gupdate: GUpdate;
}

export interface GUpdate {
  '@_protocol': string;
  '@_server': string;
  daystart: Daystart;
  app: App | App[];
}

export interface Daystart {
  '@_elapsed_seconds': number;
}

export interface App {
  '@_appid': string;
  '@_status': string;
  updatecheck: UpdateCheck;
}

export interface UpdateCheck {
  '@_codebase': string;
  '@_hash': string;
  '@_size': number;
  '@_status': string;
  '@_version': string;
}

export interface CRLSetHeader {
  /**
   * The version of the CRLSet file format. This is expected to be 0.
   */
  Version: number;
  /**
   * The content type of the file. This should always be 'CRLSet'.
   */
  ContentType: 'CRLSet';
  /**
   * A monotonically increasing number representing the version of the content.
   * This is used to determine if a newer CRLSet is available.
   */
  Sequence: number;
  /**
   * For delta updates, this is the sequence number of the full CRLSet that
   * this delta should be applied to. For a full CRLSet, this will be 0.
   */
  DeltaFrom: number;
  /**
   * The number of parent SPKI hashes in the set.
   */
  NumParents: number;
  /**
   * A list of Base64-encoded, SHA-256-hashed SubjectPublicKeyInfos that
   * are globally blocked.
   */
  BlockedSPKIs: string[];
  /**
   * A list of Base64-encoded, SHA-256-hashed SubjectPublicKeyInfos known
   * to be used for interception.
   */
  KnownInterceptionSPKIs: string[];
  /**
   * A list of Base64-encoded, SHA-256-hashed SubjectPublicKeyInfos known to
   * be used for interception and that should be actively blocked.
   */
  BlockedInterceptionSPKIs: string[];
  /**
   * The number of seconds since the Unix epoch, after which, this CRLSet
   * is considered expired.
   */
  NotAfter: number;
}

/**
 * Represents the outcome of a certificate revocation check.
 */
export enum RevocationStatus {
  /** The certificate is not considered revoked by this CRLSet. */
  OK,
  /** The certificate is revoked because its issuer's SPKI is globally blocked. */
  REVOKED_BY_SPKI,
  /** The certificate is revoked because its serial number is listed for its issuer. */
  REVOKED_BY_SERIAL,
}

// See: src/proto/crx3.proto
export interface CrxFileHeader {
  sha256WithRsa: AsymmetricKeyProof[];
  sha256WithEcdsa: AsymmetricKeyProof[];
  signedHeaderData: string;
}

export interface AsymmetricKeyProof {
  publicKey: string;
  signature: string;
}
