import protobuf from 'protobufjs';
import { resolve } from 'path';

let crxHeaderType: protobuf.Type | null = null;
export async function getCrxHeaderType(): Promise<protobuf.Type> {
  if (crxHeaderType) {
    return crxHeaderType;
  }
  const protoPath = resolve(process.cwd(), 'src/proto/crx3.proto');
  const root = await protobuf.load(protoPath);
  crxHeaderType = root.lookupType('crx_file.CrxFileHeader');
  return crxHeaderType;
}
