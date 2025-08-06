import protobuf from 'protobufjs';
import { join } from 'path';
import { getDirname } from './path.js';

let crxHeaderType: protobuf.Type | null = null;
export async function getCrxHeaderType(): Promise<protobuf.Type> {
  if (crxHeaderType) {
    return crxHeaderType;
  }
  const protoPath = join(getDirname(), '..', 'proto', 'crx3.proto');
  const root = await protobuf.load(protoPath);
  crxHeaderType = root.lookupType('crx_file.CrxFileHeader');
  return crxHeaderType;
}
