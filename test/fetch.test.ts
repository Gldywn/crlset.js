import { jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { CRL_SET_FIXTURE_PATH } from './utils';
import { OMAHA_BASE_URL, CRLSET_APP_ID, downloadLatestCRLSetCrx, fetchRemoteHeader } from '../src';

const CRX_URL = `${OMAHA_BASE_URL}/${CRLSET_APP_ID}.crx`;
const MOCK_XML_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0" server="prod">
  <daystart elapsed_seconds="42913"/>
  <app appid="${CRLSET_APP_ID}" status="ok">
    <updatecheck codebase="${CRX_URL}" hash="" size="0" status="ok" version="12345"/>
  </app>
</gupdate>`;

describe('CRLSet fetching', () => {
  let crxBuffer: Buffer;

  beforeAll(() => {
    crxBuffer = readFileSync(CRL_SET_FIXTURE_PATH);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should download the CRX file successfully', async () => {
    const mockFetch = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(MOCK_XML_RESPONSE, { status: 200 }))
      .mockResolvedValueOnce(new Response(crxBuffer, { status: 200 }));

    global.fetch = mockFetch;

    const resultBuffer = await downloadLatestCRLSetCrx();

    expect(resultBuffer).toBeInstanceOf(Buffer);
    expect(resultBuffer.equals(crxBuffer)).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(
      `${OMAHA_BASE_URL}?x=id%3D${CRLSET_APP_ID}%26v%3D%26uc%26acceptformat%3Dcrx3`,
    );
    expect(mockFetch).toHaveBeenCalledWith(CRX_URL);
  });

  it('should throw an error if the Omaha request fails', async () => {
    const mockFetch = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('Server Error', { status: 500, statusText: 'Internal Server Error' }));
    global.fetch = mockFetch;

    await expect(downloadLatestCRLSetCrx()).rejects.toThrow(
      'Failed to fetch CRLSet version info: 500 Internal Server Error',
    );
  });

  it('should throw an error if the Omaha response is malformed', async () => {
    const mockFetch = jest.fn<typeof fetch>().mockResolvedValueOnce(new Response('<badxml/>', { status: 200 }));
    global.fetch = mockFetch;

    await expect(downloadLatestCRLSetCrx()).rejects.toThrow('Could not find CRLSet download URL in Omaha response.');
  });

  it('should throw an error if the CRX download fails', async () => {
    const mockFetch = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(MOCK_XML_RESPONSE, { status: 200 }))
      .mockResolvedValueOnce(new Response('Not Found', { status: 404, statusText: 'Not Found' }));

    global.fetch = mockFetch;

    await expect(downloadLatestCRLSetCrx()).rejects.toThrow(
      `Failed to download CRX file from ${CRX_URL}: 404 Not Found`,
    );
  });
});

describe('CRLSet header fetching', () => {
  let crxBuffer: Buffer;

  beforeAll(() => {
    crxBuffer = readFileSync(CRL_SET_FIXTURE_PATH);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fetch and parse the remote header successfully', async () => {
    const mockFetch = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(MOCK_XML_RESPONSE, { status: 200 }))
      .mockResolvedValueOnce(new Response(crxBuffer.subarray(0, 4096), { status: 200 }));

    global.fetch = mockFetch;

    const header = await fetchRemoteHeader();

    expect(header).toBeDefined();
    expect(header.ContentType).toBe('CRLSet');
    expect(typeof header.Sequence).toBe('number');
  });

  it('should throw an error if the partial download fails', async () => {
    const mockFetch = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(MOCK_XML_RESPONSE, { status: 200 }))
      .mockResolvedValueOnce(new Response('Server Error', { status: 500, statusText: 'Internal Server Error' }));

    global.fetch = mockFetch;

    await expect(fetchRemoteHeader()).rejects.toThrow(
      'Failed to fetch CRLSet header: 500 Internal Server Error',
    );
  });

  it('should throw an error if the CRX archive does not contain a CRLSet file', async () => {
    const adm_zip = (await import('adm-zip')).default;
    const zip = new adm_zip();
    zip.addFile('not-crl-set', Buffer.from(''));
    const zipBuffer = zip.toBuffer();
    const crx = Buffer.concat([Buffer.from('Cr24\x03\x00\x00\x00'), Buffer.alloc(4), Buffer.alloc(0), zipBuffer]);
    crx.writeUInt32LE(0, 8);

    const mockFetch = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(MOCK_XML_RESPONSE, { status: 200 }))
      .mockResolvedValueOnce(new Response(crx, { status: 200 }));

    global.fetch = mockFetch;

    await expect(fetchRemoteHeader()).rejects.toThrow("Expected to find 'crl-set' but found 'not-crl-set'.");
  });
});

