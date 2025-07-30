/**
 * @script
 * This script downloads the latest CRLSet and saves it as a test fixture.
 * This allows our tests to run against a static, real-world data file without
 * making network requests, ensuring they are fast and reliable.
 *
 * To run this script, you can use tsx:
 * `npx tsx scripts/fetch-test-crlset.ts`
 */
import { join } from 'node:path';
import { writeFile } from 'fs/promises';
import { downloadLatestCRLSetCrx } from '../src/fetch';
import { getTestDataDir } from './utils';

const TEST_DATA_DIR = getTestDataDir();

async function main() {
  console.log('[*] Downloading latest CRLSet...');

  try {
    const crxBuffer = await downloadLatestCRLSetCrx();
    const crxOutputPath = join(TEST_DATA_DIR, 'crlset.crx');
    await writeFile(crxOutputPath, crxBuffer);
    console.log(`[+] CRLSet successfully saved to ${crxOutputPath}`);
  } catch (error) {
    console.error('[-] Failed to download CRLSet fixture', error);
    process.exit(1);
  }
}

main();
