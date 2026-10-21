import { randomBytes, randomInt } from 'crypto';

export const newId = (prefix: string) => `${prefix}_${randomBytes(6).toString('hex')}`;
export const newToken = () => randomBytes(24).toString('base64url');
export const sixDigitCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
