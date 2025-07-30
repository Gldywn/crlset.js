import AdmZip from 'adm-zip';
import type { CRLSetHeader } from './interfaces';
import { CRX_MAGIC } from './constants';

/**
 * Parses a raw CRX file buffer to extract the `crl-set` data.
 *
 * This function follows the logic from the Go tool, skipping the
 * protobuf header to directly access the ZIP archive.
 *
 * @param crxBuffer The buffer containing the CRX file data.
 * @returns A buffer with the raw `crl-set` data.
 * @throws If the file is not a valid CRXv3 file or `crl-set` is not found.
 */
export function unpackCrx(crxBuffer: Buffer): Buffer {
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

  const zipBuffer = crxBuffer.subarray(zipOffset);

  const zip = new AdmZip(zipBuffer);
  const crlSetEntry = zip.getEntry('crl-set');

  if (!crlSetEntry) {
    throw new Error('CRX archive does not contain a "crl-set" file.');
  }

  return crlSetEntry.getData();
}

/**
 * Parses the binary `crl-set` data into a structured format.
 *
 * The `crl-set` file consists of a JSON header followed by a binary
 * body containing SPKI hashes and associated revoked certificate serial numbers.
 *
 * @param crlSetBuffer The buffer containing the raw `crl-set` data.
 * @returns An object containing the parsed header and the revocation map.
 */
export function parseCRLSet(crlSetBuffer: Buffer): {
  header: CRLSetHeader;
  revocations: Map<string, Set<string>>;
} {
  if (crlSetBuffer.length < 2) {
    throw new Error('CRLSet file is truncated (at header length).');
  }
  const headerLen = crlSetBuffer.readUInt16LE(0);

  if (crlSetBuffer.length < 2 + headerLen) {
    throw new Error('CRLSet file is truncated (at header content).');
  }
  const headerBytes = crlSetBuffer.subarray(2, 2 + headerLen);
  const header = JSON.parse(headerBytes.toString('utf8')) as CRLSetHeader;

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
 * High-level function to process a raw CRX file buffer.
 * It unpacks the CRX and parses the contained `crl-set`.
 *
 * @param crxBuffer The buffer containing the raw CRX file.
 * @returns The parsed CRLSet data.
 */
export function processCrx(crxBuffer: Buffer) {
  const crlSetBuffer = unpackCrx(crxBuffer);
  return parseCRLSet(crlSetBuffer);
}
