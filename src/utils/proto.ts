import protobuf from 'protobufjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let crxHeaderType: protobuf.Type | null = null;
export async function getCrxHeaderType(): Promise<protobuf.Type> {
  if (crxHeaderType) {
    return crxHeaderType;
  }
  const protoPath = join(__dirname, '..', 'proto', 'crx3.proto');
  const root = await protobuf.load(protoPath);
  crxHeaderType = root.lookupType('crx_file.CrxFileHeader');
  return crxHeaderType;
}
