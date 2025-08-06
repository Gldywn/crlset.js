export function getDirname(): string {
  if (typeof import.meta?.url === 'string') {
    const { fileURLToPath } = require('url');
    const { dirname } = require('path');
    return dirname(fileURLToPath(import.meta.url));
  }
  return __dirname;
}
