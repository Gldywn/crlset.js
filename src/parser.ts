import AdmZip from 'adm-zip';
import type { CRLSetHeader, CrxFileHeader } from './interfaces.js';
import { verifyCrxSignature } from './verify.js';
import { getCrxHeaderType } from './utils/proto.js';
import { CRX_MAGIC, CRL_SET_ZIP_ENTRY } from './constants.js';

/**
 * Parses a raw CRX file buffer to extract the Protobuf header and ZIP archive buffer.
 *
 * This function follows the logic from the Go tool, skipping the
 * protobuf header to directly access the ZIP archive.
 *
 * @param crxBuffer The buffer containing the CRX file data.
 * @returns An object with the parsed Protobuf header (`header`) and the ZIP archive buffer (`zipBuffer`).
 * @throws If the file is not a valid CRXv3 file or if the header length is invalid.
 */
export function unpackCrx(crxBuffer: Buffer): {
  header: CrxFileHeader;
  zipBuffer: Buffer;
} {
  const magic = crxBuffer.toString('ascii', 0, 4);
  if (magic !== CRX_MAGIC) {
    throw new Error(`Invalid CRX magic: expected ${CRX_MAGIC}, got ${magic}`);
  }

  const version = crxBuffer.readUInt32LE(4);
  if (version !== 3) {
    throw new Error(`Unsupported CRX version: expected 3, got ${version}`);
  }

  const headerLen = crxBuffer.readUInt32LE(8);
  const zipOffset = 12 + headerLen;

  if (zipOffset > crxBuffer.length) {
    throw new Error('Invalid CRX header: header length exceeds file size.');
  }

  const protoHeaderBuffer = crxBuffer.subarray(12, zipOffset);
  const CrxHeader = getCrxHeaderType();
  const header = CrxHeader.decode(protoHeaderBuffer).toJSON() as CrxFileHeader;

  const zipBuffer = crxBuffer.subarray(zipOffset);

  return { header, zipBuffer };
}

/**
 * Extracts the CRLSet file from a ZIP archive buffer.
 *
 * This function opens the provided ZIP buffer, searches for the `crl-set` entry,
 * and returns its raw data as a Buffer.
 *
 * @param zipBuffer The buffer containing the ZIP archive data.
 * @returns The raw Buffer of the CRLSet file.
 * @throws If the ZIP archive does not contain a CRLSet file.
 */
function extractCrlSetFromZip(zipBuffer: Buffer): Buffer {
  const zip = new AdmZip(zipBuffer);
  const crlSetEntry = zip.getEntry(CRL_SET_ZIP_ENTRY);

  if (!crlSetEntry) {
    throw new Error('CRX archive does not contain a CRLSet file.');
  }

  return crlSetEntry.getData();
}

/**
 * Parses the binary CRLSet data into a structured format.
 *
 * The CRLSet file consists of a JSON header followed by a binary
 * body containing SPKI hashes and associated revoked certificate serial numbers.
 *
 * @param crlSetBuffer The buffer containing the raw CRLSet data.
 * @returns An object containing the parsed header and the revocation map.
 */
export function parseCRLSet(crlSetBuffer: Buffer): {
  header: CRLSetHeader;
  revocations: Map<string, Set<string>>;
} {
  const header = parseCRLSetHeader(crlSetBuffer);
  console.log('Header', header);
  const headerLen = crlSetBuffer.readUInt16LE(0);
  const revocations = new Map<string, Set<string>>();
  let offset = 2 + headerLen;

  for (let i = 0; i < header.NumParents; i++) {
    if (offset + 32 > crlSetBuffer.length) {
      throw new Error('CRLSet file is truncated (at SPKI hash).');
    }

    const spkiHash = crlSetBuffer.subarray(offset, offset + 32).toString('hex');
    offset += 32;

    if (offset + 4 > crlSetBuffer.length) {
      throw new Error('CRLSet file is truncated (at serial count).');
    }
    const numSerials = crlSetBuffer.readUInt32LE(offset);
    offset += 4;

    const serials = new Set<string>();
    for (let j = 0; j < numSerials; j++) {
      if (offset + 1 > crlSetBuffer.length) {
        throw new Error('CRLSet file is truncated (at serial length).');
      }
      const serialLen = crlSetBuffer.readUInt8(offset);
      offset += 1;

      if (offset + serialLen > crlSetBuffer.length) {
        throw new Error('CRLSet file is truncated (at serial number).');
      }
      const serial = crlSetBuffer.subarray(offset, offset + serialLen).toString('hex');
      serials.add(serial);
      offset += serialLen;
    }
    revocations.set(spkiHash, serials);
  }

  return { header, revocations };
}

/**
 * Parses only the header of a binary CRLSet.
 *
 * This function is a lighter version of `parseCRLSet` that only extracts the
 * JSON header, which is useful for quickly checking metadata like the sequence
 * number or expiration date without parsing the entire file.
 *
 * @param crlSetBuffer The buffer containing the raw CRLSet data.
 * @returns The parsed CRLSet header.
 */
export function parseCRLSetHeader(crlSetBuffer: Buffer): CRLSetHeader {
  if (crlSetBuffer.length < 2) {
    throw new Error('CRLSet file is truncated (at header length).');
  }
  const headerLen = crlSetBuffer.readUInt16LE(0);

  if (crlSetBuffer.length < 2 + headerLen) {
    throw new Error('CRLSet file is truncated (at header content).');
  }
  const headerBytes = crlSetBuffer.subarray(2, 2 + headerLen);
  return JSON.parse(headerBytes.toString('utf8')) as CRLSetHeader;
}

/**
 * High-level function to process a raw CRX file buffer.
 * It unpacks the CRX, (optionally) verifies its signature, and parses the contained CRLSet.
 *
 * @param crxBuffer The buffer containing the raw CRX file.
 * @param options Options, including whether to verify the signature.
 * @returns The parsed CRLSet data.
 */
export async function processCrx(
  crxBuffer: Buffer,
  verifySignature: boolean,
) {
  const { header: crxHeader, zipBuffer } = unpackCrx(crxBuffer);

  if (verifySignature) {
    const isSignatureValid = await verifyCrxSignature(crxHeader, zipBuffer);
    if (!isSignatureValid) {
      throw new Error('CRX signature verification failed.');
    }
  }

  const crlSetBuffer = extractCrlSetFromZip(zipBuffer);
  return parseCRLSet(crlSetBuffer);
}
