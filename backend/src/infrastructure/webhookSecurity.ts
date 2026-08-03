import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

const key = () => { const material = process.env.WEBHOOK_ENCRYPTION_KEY; if (!material) throw new Error('WEBHOOK_ENCRYPTION_KEY is required'); return createHash('sha256').update(material).digest(); };
export function encryptWebhookSecret(secret: string) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(), iv); const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]); return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.'); }
export function decryptWebhookSecret(value: string) { const [iv, tag, encrypted] = value.split('.'); if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted webhook secret'); const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url')); decipher.setAuthTag(Buffer.from(tag, 'base64url')); return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8'); }
export function webhookSignature(payload: string, secret: string) { return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`; }

function privateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (isIP(address) === 4) { const [a = 0, b = 0] = address.split('.').map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.') || normalized.startsWith('::ffff:192.168.');
}

export async function validateWebhookUrl(value: string, resolver = lookup) {
  let url: URL; try { url = new URL(value); } catch { throw new Error('Webhook URL is invalid'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Webhook URL must use HTTP or HTTPS');
  if (url.username || url.password) throw new Error('Webhook URL cannot contain credentials');
  if ([...url.searchParams.keys()].some((name) => /token|secret|password|api[_-]?key|signature/i.test(name))) throw new Error('Webhook credentials must use the signing secret, not URL parameters');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) throw new Error('Local webhook destinations are not allowed');
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await resolver(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => privateAddress(address))) throw new Error('Private or local webhook destinations are not allowed');
  return url.toString();
}
