import { describe, expect, it, vi } from 'vitest';
import { ObjectStorageService, StorageUnavailableError } from '../src/infrastructure/storage';
import type { StorageConfig } from '../src/infrastructure/storageConfig';
import { storeAttachment } from '../src/services/attachments';

const config: StorageConfig = {
  endpoint: 'localhost',
  port: 9000,
  accessKey: 'access',
  secretKey: 'secret',
  bucket: 'private-attachments',
  useSSL: false,
  signedUrlExpirySeconds: 900,
  createBucket: true,
};

function createClientMock() {
  return {
    bucketExists: vi.fn().mockResolvedValue(true),
    makeBucket: vi.fn().mockResolvedValue(undefined),
    putObject: vi.fn().mockResolvedValue({ etag: 'etag', versionId: null }),
    removeObject: vi.fn().mockResolvedValue(undefined),
    presignedGetObject: vi.fn().mockResolvedValue('http://signed-url'),
  };
}

describe('ObjectStorageService', () => {
  it('creates a missing private bucket once and uploads without a public policy', async () => {
    const client = createClientMock();
    client.bucketExists.mockResolvedValue(false);
    const storage = new ObjectStorageService(client, config);

    await storage.upload('items/item-1/file.txt', Buffer.from('content'), 7, 'text/plain');
    await storage.upload('items/item-1/file-2.txt', Buffer.from('other'), 5, 'text/plain');

    expect(client.bucketExists).toHaveBeenCalledTimes(1);
    expect(client.makeBucket).toHaveBeenCalledWith('private-attachments');
    expect(client.putObject).toHaveBeenCalledWith(
      'private-attachments',
      'items/item-1/file.txt',
      expect.any(Buffer),
      7,
      { 'Content-Type': 'text/plain' },
    );
  });

  it('generates a temporary URL with the configured expiration', async () => {
    const client = createClientMock();
    const storage = new ObjectStorageService(client, config);

    const url = await storage.createSignedDownloadUrl('items/item-1/file.txt');

    expect(url).toBe('http://signed-url');
    expect(client.presignedGetObject).toHaveBeenCalledWith(
      'private-attachments',
      'items/item-1/file.txt',
      900,
    );
  });

  it('returns a consistent error when MinIO is unavailable', async () => {
    const client = createClientMock();
    client.bucketExists.mockRejectedValue(new Error('connection refused'));
    const storage = new ObjectStorageService(client, config);

    await expect(storage.ensureBucket()).rejects.toBeInstanceOf(StorageUnavailableError);
  });
});

describe('storeAttachment', () => {
  it('removes the uploaded object when database persistence fails', async () => {
    const storage = {
      upload: vi.fn().mockResolvedValue({ bucket: 'private-attachments', objectKey: 'items/item-1/file.txt' }),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const persist = vi.fn().mockRejectedValue(new Error('database unavailable'));

    await expect(storeAttachment({
      itemId: 'item-1',
      userId: 'user-1',
      originalName: 'file.txt',
      mimeType: 'text/plain',
      sizeBytes: 7,
      checksum: 'sha256:example',
      content: Buffer.from('content'),
    }, {
      storage: storage as never,
      persist,
    })).rejects.toThrow('database unavailable');

    expect(storage.remove).toHaveBeenCalledWith('items/item-1/file.txt');
  });
});
