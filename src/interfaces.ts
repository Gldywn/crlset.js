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
  Sequence: number;
  NumParents: number;
  NotAfter: number;
  BlockedSPKIs: string[];
  KnownInterceptionSPKIs: string[];
  BlockedInterceptionSPKIs: string[];
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
