import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptWebhookSecret, encryptWebhookSecret, validateWebhookUrl, webhookSignature } from '../src/infrastructure/webhookSecurity';

process.env.WEBHOOK_ENCRYPTION_KEY = 'test-webhook-encryption-key';

describe('webhook security', () => {
  it('signs the exact versioned payload with HMAC SHA-256', () => {
    const payload = JSON.stringify({ eventId: 'event-1', version: 1, eventType: 'ITEM_CREATED' });
    expect(webhookSignature(payload, 'secret')).toBe(`sha256=${createHmac('sha256', 'secret').update(payload).digest('hex')}`);
  });
  it('encrypts secrets at rest and decrypts them for delivery', () => {
    const encrypted = encryptWebhookSecret('consumer-secret');
    expect(encrypted).not.toContain('consumer-secret');
    expect(decryptWebhookSecret(encrypted)).toBe('consumer-secret');
  });
  it('blocks local and private webhook destinations', async () => {
    await expect(validateWebhookUrl('http://127.0.0.1/hook')).rejects.toThrow('Private');
    await expect(validateWebhookUrl('http://localhost/hook')).rejects.toThrow('Local');
    await expect(validateWebhookUrl('https://hooks.example.test/hook', async () => [{ address: '10.0.0.2', family: 4 }])).rejects.toThrow('Private');
  });
});
