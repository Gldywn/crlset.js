import protobuf from 'protobufjs';
import crx3Proto from '../proto/crx3.proto';

let crxHeaderType: protobuf.Type | null = null;
export function getCrxHeaderType(): protobuf.Type {
  if (crxHeaderType) {
    return crxHeaderType;
  }
  const { root } = protobuf.parse(crx3Proto);
  crxHeaderType = root.lookupType('crx_file.CrxFileHeader');
  return crxHeaderType;
}
