// @ts-ignore
import { loadLatestCRLSet, RevocationStatus } from '../dist';

async function main() {
  try {
    console.log('\nLoading the latest CRLSet...');
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

    /*
    crlSet.check(revokedBySpkiInfo.spkiHash, notRevokedInfo.serialNumber); // REVOKED_BY_SPKI
    crlSet.check(notRevokedInfo.spkiHash, notRevokedInfo.serialNumber); // OK
    */
  } catch (error) {
    console.error('Error while verifying against the CRLSet:', error);
  }
}

main();
