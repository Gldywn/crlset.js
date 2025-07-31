export const asPemKey = (key: Buffer) => {
  return `-----BEGIN PUBLIC KEY-----\n${key.toString('base64')}\n-----END PUBLIC KEY-----`;
};
