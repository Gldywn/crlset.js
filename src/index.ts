export * from './constants.js';
export * from './interfaces.js';

export * from './fetch.js';
export * from './parser.js';
export * from './verify.js';
export * from './crlset.js';

import { downloadLatestCRLSetCrx } from './fetch.js';
import { processCrx } from './parser.js';
import { CRLSet } from './crlset.js';

/**
 * Fetches the latest CRLSet from the Google Omaha proxy,
 * processes the CRX file, and returns a CRLSet instance.
 *
 * @param options Options, including whether to verify the signature.
 * @returns A new `CRLSet` instance containing the latest revocation data.
 */
export async function loadLatestCRLSet(
  options: { verifySignature?: boolean } = { verifySignature: true },
): Promise<CRLSet> {
  const crxBuffer = await downloadLatestCRLSetCrx();
  const { header, revocations } = await processCrx(crxBuffer, options);
  return new CRLSet(header, revocations);
}
