<p align="center">
  <img src="./assets/header.png" alt="crlset.js"/>
</p>

# CRLSet.js

CRLSet.js is a lightweight CRLSet parser and verifier in TypeScript for Node.js. It fetches and parses the latest Chrome CRLSet in memory, with support for checking whether a certificate or its issuer has been revoked.

[![Build Status](https://github.com/Gldywn/crlset.js/actions/workflows/build.yml/badge.svg)](https://github.com/Gldywn/crlset.js/actions/workflows/build.yml)
[![Coverage Status (codecov.io)](https://codecov.io/gh/Gldywn/crlset.js/branch/main/graph/badge.svg)](https://codecov.io/gh/Gldywn/crlset.js)
[![npm](https://img.shields.io/npm/v/@gldywn/crlset.js.svg)](https://www.npmjs.com/package/@gldywn/crlset.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [CRLSet](https://www.chromium.org/Home/chromium-security/crlsets/) is a collection of certificate revocation information aggregated by Google and used in Chrome to quickly identify and block revoked certificates. Unlike traditional Certificate Revocation Lists (CRLs) or the Online Certificate Status Protocol (OCSP), which can be slow and unreliable, CRLSets provide a fast and efficient mechanism for checking the revocation status of a certificate.

This library handles the process of fetching the latest CRLSet from Google's Omaha proxy, verifies its signature to ensure its integrity, parses it, and makes it available for revocation checks. It is designed for easy embedding in HTTPS agents or TLS validation flows. While it offers a simple one-line function for most use cases, it also exports its core components for more advanced, custom implementations.

## Installation

```sh
npm install @gldywn/crlset.js
```

## Basic Usage

The primary function of this library is to determine if a given certificate has been revoked according to the latest CRLSet. This is done by checking the certificate's issuer and serial number against the blocklists in the CRLSet.

> For a complete, runnable example, see [examples/verify.ts](./examples/verify.ts).

```typescript
console.log('Loading the latest CRLSet...');
/*
 * By default, `loadLatestCRLSet` verifies the CRX signature, checks for a newer version,
 * and downloads it if available. The latest version is cached to avoid redundant downloads.
 * For customization:
 *  - `verifySignature: false`: Disables CRX signature verification (not recommended).
 *  - `updateStrategy: 'on-expiry'`: Updates only when the cached version hard-expires (not recommended).
 * e.g. `await loadLatestCRLSet({ verifySignature: false, updateStrategy: 'on-expiry' })`
 */
const crlSet = await loadLatestCRLSet();
console.log(
  `Successfully loaded CRLSet ${crlSet.sequence} (${crlSet.getBlockedSpkiCount()} blocked SPKIs, ${crlSet.getRevocationCount()} revocations).`,
);

const revokedBySerialInfo = {
  spkiHash: '03b4392598a10a3ff5695cf02a5775586b170f564a808a4d41568578a184e329',
  serialNumber: '179cc56dc82dbded5573c7999997f646',
};

console.log(
  `\nChecking certificate with issuer SPKI hash: ${revokedBySerialInfo.spkiHash} and serial number: ${revokedBySerialInfo.serialNumber}...`,
);
const status = crlSet.check(revokedBySerialInfo.spkiHash, revokedBySerialInfo.serialNumber);
console.log(`Certificate revocation status: ${RevocationStatus[status]}`); // REVOKED_BY_SERIAL

// [...]
crlSet.check(revokedBySpkiInfo.spkiHash, notRevokedInfo.serialNumber); // REVOKED_BY_SPKI
crlSet.check(notRevokedInfo.spkiHash, notRevokedInfo.serialNumber); // OK
```

## Advanced Usage

For more specific use cases, you can use the `CRLSet` class and other exported functions directly. This allows you to construct a `CRLSet` instance from custom data or leverage the library's internal mechanics for your own logic. This makes `crlset.js` a versatile "Swiss Army knife" for handling CRLSets.

### Granular Checks

While the `check` method performs a comprehensive verification, you can also call the underlying methods directly if you need to distinguish between different revocation reasons:

```typescript
const isRevokedBySpki = crlSet.isRevokedBySPKI(certificateInfo.spkiHash);
console.log(`Is certificate revoked by SPKI?: ${isRevokedBySpki}`);

const isRevokedBySerial = crlSet.isRevokedBySerial(certificateInfo.spkiHash, certificateInfo.serialNumber);
console.log(`Is certificate revoked by serial?: ${isRevokedBySerial}`);
```

### Direct `CRLSet` Instantiation

You can create a `CRLSet` instance yourself if you have the header and revocation data.

```typescript
import { CRLSet, RevocationStatus } from '@gldywn/crlset.js';
import type { CRLSetHeader } from '@gldywn/crlset.js';

// Define the header and revocation data
const header: CRLSetHeader = {
  Sequence: 1,
  NumParents: 1,
  BlockedSPKIs: [],
  NotAfter: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
  ContentType: 'CRLSet',
  DeltaFrom: 0,
};

const revocations = new Map<string, Set<string>>();
const spkiHash = 'a_spki_hash_in_hex';
const serials = new Set(['a_serial_number_in_hex']);
revocations.set(spkiHash, serials);

// Create a new CRLSet instance
const crlSet = new CRLSet(header, revocations);

// Use it as usual
const status = crlSet.check(spkiHash, 'a_serial_number_in_hex');
console.log(RevocationStatus[status]); // REVOKED_BY_SERIAL
```

### Exported Utility Functions

The library exports most of its internal functions, allowing you to build custom logic:

- **`fetchCrxUrl()`**: Retrieves the download URL for the latest CRLSet CRX file from Google's Omaha proxy.
- **`downloadLatestCRLSetCrx()`**: Downloads the full CRLSet CRX file and returns it as a Buffer.
- **`fetchRemoteHeader()`**: Performs a partial download to fetch only the header of the latest CRLSet, useful for quick version checks.
- **`unpackCrx(crxBuffer)`**: Parses a raw CRX file buffer, separating the Protobuf header from the main ZIP content.
- **`processCrx(crxBuffer, verifySignature)`**: A high-level function that unpacks a CRX file, optionally verifies its signature, and parses the contained CRLSet data.
- **`parseCRLSet(crlSetBuffer)`**: Parses the binary CRLSet data (the `crl-set` file from the ZIP) into a structured header and a map of revocations.
- **`parseCRLSetHeader(crlSetBuffer)`**: A lightweight parser that reads only the JSON header from the CRLSet data.
- **`verifyCrxSignature(crxHeader, zipBuffer)`**: Verifies the signature of a CRX file against the public keys in its header.

## Test

This project includes a comprehensive test suite to ensure correctness and stability.

### Running Tests

To run the complete test suite:

```sh
npm test
```

## License

CRLSet.js is distributed under the MIT license.
