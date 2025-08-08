<p align="center">
  <img src="./assets/header.png" alt="crlset.js"/>
</p>

# CRLSet.js

CRLSet.js is a lightweight CRLSet parser and verifier in TypeScript for Node.js. It fetches and parses the latest Chrome CRLSet in memory, with support for checking whether a certificate or its issuer has been revoked.

[![Build Status](https://github.com/Gldywn/crlset.js/actions/workflows/build.yml/badge.svg)](https://github.com/Gldywn/crlset.js/actions/workflows/build.yml)
[![Coverage Status (codecov.io)](https://codecov.io/gh/Gldywn/crlset.js/branch/main/graph/badge.svg)](https://codecov.io/gh/Gldywn/crlset.js)
[![npm](https://img.shields.io/npm/v/@gldywn/crlset.js.svg)](https://www.npmjs.com/package/@gldywn/crlset.js)

A [CRLSet](https://www.chromium.org/Home/chromium-security/crlsets/) is a collection of certificate revocation information aggregated by Google and used in Chrome to quickly identify and block revoked certificates. Unlike traditional Certificate Revocation Lists (CRLs) or the Online Certificate Status Protocol (OCSP), which can be slow and unreliable, CRLSets provide a fast and efficient mechanism for checking the revocation status of a certificate.

This library handles the process of fetching the latest CRLSet from Google's Omaha proxy, verifies its signature to ensure its integrity, parses it, and makes it available for revocation checks. It is designed to be embedded in HTTPS agents or TLS validation flows to reject revoked certificates without relying on traditional revocation mechanisms.

## Installation

```sh
npm install @gldywn/crlset.js
```

## Usage

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

While the `check` method performs a comprehensive verification, you can also call the underlying methods directly if you need to:

```typescript
const isRevokedBySpki = crlSet.isRevokedBySPKI(certificateInfo.spkiHash);
console.log(`Is certificate revoked by SPKI?: ${isRevokedBySpki}`);

const isRevokedBySerial = crlSet.isRevokedBySerial(certificateInfo.spkiHash, certificateInfo.serialNumber);
console.log(`Is certificate revoked by serial?: ${isRevokedBySerial}`);
```

## Test

This project includes a comprehensive test suite to ensure correctness and stability.

### Running Tests

To run the complete test suite:

```sh
npm test
```

## License

CRLSet.js is distributed under the MIT license.
