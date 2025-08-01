import { createHash, createVerify } from 'crypto';
import type { CrxFileHeader } from './interfaces.js';
import { CRLSET_APP_ID, SIGNED_DATA_PREFIX } from './constants.js';
import { asPemKey } from './utils/crypto.js';

/**
 * Verifies the signature of a CRX file.
 *
 * @param header The parsed Protobuf header of the CRX file.
 * @param zipBuffer The buffer containing the ZIP archive of the CRX file.
 * @returns `true` if the signature is valid, `false` otherwise.
 * @throws If no valid key for the CRLSet component is found.
 */
export async function verifySignature(header: CrxFileHeader, zipBuffer: Buffer): Promise<boolean> {
  if (!header.signedHeaderData) {
    throw new Error('CRX signature verification failed: signedHeaderData is missing.');
  }

  // Find the correct public key by matching its hash against the app ID
  const { publicKey, signature } = findCrlSetKey(header);
  if (!publicKey || !signature) {
    throw new Error('CRX signature verification failed: no valid publicKey for the CRLSet component found.');
  }

  // Reconstruct the data that was originally signed
  const signedHeaderDataBuffer = Buffer.from(header.signedHeaderData, 'base64');
  const sizeBuffer = Buffer.alloc(4);
  sizeBuffer.writeUInt32LE(signedHeaderDataBuffer.length);
  const dataToVerify = Buffer.concat([SIGNED_DATA_PREFIX, sizeBuffer, signedHeaderDataBuffer, zipBuffer]);

  const verifier = createVerify('sha256');
  verifier.update(dataToVerify);

  return verifier.verify(asPemKey(publicKey), signature);
}

/**
 * Finds the public key and signature associated with the CRLSet component.
 *
 * It works by hashing each public key in the header and comparing it to a
 * derived form of the component's app ID.
 *
 * @param header The parsed Protobuf header.
 * @returns The public key and signature for the CRLSet, or `undefined` if not found.
 */
function findCrlSetKey(header: CrxFileHeader): {
  publicKey: Buffer | undefined;
  signature: Buffer | undefined;
} {
  const expectedId = crxIdToHex(CRLSET_APP_ID);

  for (const proof of [...header.sha256WithRsa, ...header.sha256WithEcdsa]) {
    const publicKey = Buffer.from(proof.publicKey, 'base64');
    const hash = createHash('sha256').update(publicKey).digest('hex');
    const id = hash.substring(0, 32);

    if (id === expectedId) {
      return { publicKey, signature: Buffer.from(proof.signature, 'base64') };
    }
  }

  return { publicKey: undefined, signature: undefined };
}

/**
 * Converts a Chrome extension ID (from the webstore) to the hex format
 * used for key hash comparison.
 *
 * Chrome's app IDs are encoded using the letters 'a' through 'p' as hex digits.
 * 'a' corresponds to 0, 'b' to 1, and so on.
 *
 * @param appId The CRX application ID.
 * @returns The hex-encoded ID.
 */
function crxIdToHex(appId: string): string {
  return appId
    .split('')
    .map((char) => (char.charCodeAt(0) - 'a'.charCodeAt(0)).toString(16))
    .join('');
}
