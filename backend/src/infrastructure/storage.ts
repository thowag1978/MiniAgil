import { Client } from 'minio';
import type { Readable } from 'node:stream';
import { getStorageConfig, type StorageConfig } from './storageConfig';

export class StorageUnavailableError extends Error {
  constructor(operation: string, options?: ErrorOptions) {
    super(`File storage is unavailable during ${operation}`, options);
    this.name = 'StorageUnavailableError';
  }
}

type MinioClient = Pick<Client,
  'bucketExists' | 'makeBucket' | 'putObject' | 'removeObject' | 'presignedGetObject'
>;

export class ObjectStorageService {
  private bucketReady: Promise<void> | undefined;

  constructor(
    private readonly client: MinioClient,
    private readonly config: StorageConfig,
  ) {}

  private async run<T>(operation: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof StorageUnavailableError) throw error;
      throw new StorageUnavailableError(operation, { cause: error });
    }
  }

  ensureBucket() {
    if (!this.bucketReady) {
      this.bucketReady = this.run('bucket validation', async () => {
        const exists = await this.client.bucketExists(this.config.bucket);
        if (exists) return;
        if (!this.config.createBucket) {
          throw new Error(`Bucket ${this.config.bucket} does not exist`);
        }
        await this.client.makeBucket(this.config.bucket);
      }).catch((error) => {
        this.bucketReady = undefined;
        throw error;
      });
    }
    return this.bucketReady;
  }

  async upload(
    objectKey: string,
    content: Buffer | Readable,
    sizeBytes: number,
    mimeType: string,
  ) {
    await this.ensureBucket();
    await this.run('upload', () => this.client.putObject(
      this.config.bucket,
      objectKey,
      content,
      sizeBytes,
      { 'Content-Type': mimeType },
    ));
    return { bucket: this.config.bucket, objectKey };
  }

  async remove(objectKey: string, bucket = this.config.bucket) {
    await this.ensureBucket();
    await this.run('delete', () => this.client.removeObject(bucket, objectKey));
  }

  async createSignedDownloadUrl(objectKey: string, bucket = this.config.bucket) {
    await this.ensureBucket();
    return this.run('signed URL generation', () => this.client.presignedGetObject(
      bucket,
      objectKey,
      this.config.signedUrlExpirySeconds,
    ));
  }
}

export function createObjectStorageService(config = getStorageConfig()) {
  const client = new Client({
    endPoint: config.endpoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });
  return new ObjectStorageService(client, config);
}
