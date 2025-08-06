import { fileURLToPath } from 'url';
import { dirname } from 'path';

/* istanbul ignore next */
export function getDirname(): string {
  if (typeof import.meta?.url === 'string') {
    return dirname(fileURLToPath(import.meta.url));
  }
  return __dirname;
}
