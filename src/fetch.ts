import { XMLParser } from 'fast-xml-parser';
import type { OmahaResponse } from './interfaces';
import { CRLSET_APP_ID, OMAHA_BASE_URL } from './constants';

/**
 * Builds the URL to fetch the latest CRLSet version information from Google's Omaha proxy.
 *
 * Each parameter can be overridden via function arguments, except for 'acceptformat' which is always 'crx3'.
 *
 * @param appId The Omaha app ID (default: CRLSET_APP_ID)
 * @param version The version string (default: empty string)
 * @param uc Whether to include the 'uc' flag (default: true)
 * @returns The version request URL.
 */
function buildVersionRequestUrl({
  appId = CRLSET_APP_ID,
  version = '',
  uc = true,
}: {
  appId?: string;
  version?: string;
  uc?: boolean;
} = {}): string {
  let xParam = `id=${appId}&v=${version}`;
  if (uc) {
    xParam += '&uc';
  }
  xParam += '&acceptformat=crx3';

  const params = new URLSearchParams({
    x: xParam,
  });

  const url = new URL(OMAHA_BASE_URL);
  url.search = params.toString();

  return url.toString();
}

/**
 * Fetches the download URL for the latest CRLSet.
 *
 * It queries Google's Omaha server, which returns an XML response containing
 * the URL to the full CRX file.
 *
 * @returns The URL of the CRX file containing the CRLSet.
 * @throws If the CRX URL cannot be retrieved or parsed from the response.
 */
export async function fetchCrxUrl(): Promise<string> {
  const requestUrl = buildVersionRequestUrl();
  const response = await fetch(requestUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch CRLSet version info: ${response.status} ${response.statusText}`.trim());
  }

  const xmlText = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
  });
  const result = parser.parse(xmlText) as OmahaResponse;

  const apps = Array.isArray(result.gupdate?.app) ? result.gupdate.app : [result.gupdate?.app];
  const crlSetApp = apps.find((app) => app?.['@_appid'] === CRLSET_APP_ID);

  const crxUrl = crlSetApp?.updatecheck?.['@_codebase'];
  if (!crxUrl) {
    throw new Error('Could not find CRLSet download URL in Omaha response.');
  }

  return crxUrl;
}

/**
 * Downloads the latest CRLSet as a CRX file.
 *
 * @returns A Buffer containing the raw CRX file data.
 */
export async function downloadLatestCRLSetCrx(): Promise<Buffer> {
  const crxUrl = await fetchCrxUrl();

  const response = await fetch(crxUrl);
  if (!response.ok) {
    throw new Error(`Failed to download CRX file from ${crxUrl}: ${response.status} ${response.statusText}`.trim());
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
