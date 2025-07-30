/**
 * The hex-encoded public key hash of the key that signs the CRL sets.
 * This is the application ID for the CRLSet component in the Chrome Omaha update system.
 *
 * It is hardcoded in the Chromium source code and is unlikely to change.
 * If it ever does, it can be found in the Chromium source tree.
 *
 * @see https://chromium.googlesource.com/chromium/src/+/master/components/metrics/component_metrics_provider.cc#102
 */
export const CRLSET_APP_ID = 'hfnkpimlhhgieaddgfemjhofmfblmnib';

/**
 * The base URL for the Google Omaha update server.
 * This is the endpoint that Chrome browsers contact to check for component updates,
 * including new CRLSets.
 */
export const OMAHA_BASE_URL = 'https://clients2.google.com/service/update2/crx';

/**
 * The magic number for a CRX file.
 * A CRX file (Chrome Extension) is a ZIP archive with a special header.
 * The first 4 bytes of the file must be this "Cr24" string.
 *
 * @see https://developer.chrome.com/docs/extensions/how-to/distribute/crx-format
 */
export const CRX_MAGIC = 'Cr24';
