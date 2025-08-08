import { join } from 'node:path';

export function getTestDataDir(): string {
  return join(process.cwd(), 'test', 'testdata');
}