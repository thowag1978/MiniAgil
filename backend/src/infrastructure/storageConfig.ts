export type StorageConfig = {
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  bucket: string;
  useSSL: boolean;
  signedUrlExpirySeconds: number;
  createBucket: boolean;
};

export type AttachmentConfig = {
  maxSizeBytes: number;
  allowedMimeTypes: Set<string>;
  allowedExtensions: Set<string>;
};

function integerEnv(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function booleanEnv(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function getStorageConfig(): StorageConfig {
  return {
    endpoint: process.env.MINIO_ENDPOINT?.trim() || 'localhost',
    port: integerEnv('MINIO_PORT', 9000, 1, 65535),
    accessKey: requiredEnv('MINIO_ACCESS_KEY'),
    secretKey: requiredEnv('MINIO_SECRET_KEY'),
    bucket: process.env.MINIO_BUCKET?.trim() || 'miniagil-attachments',
    useSSL: booleanEnv('MINIO_USE_SSL', false),
    signedUrlExpirySeconds: integerEnv('MINIO_SIGNED_URL_EXPIRY_SECONDS', 900, 1, 604800),
    createBucket: booleanEnv('MINIO_CREATE_BUCKET', true),
  };
}

function listEnv(name: string, fallback: string) {
  const values = (process.env[name] || fallback)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (values.length === 0) throw new Error(`${name} must contain at least one value`);
  return new Set(values);
}

export function getAttachmentConfig(): AttachmentConfig {
  return {
    maxSizeBytes: integerEnv('ATTACHMENT_MAX_SIZE_BYTES', 10 * 1024 * 1024, 1, 1024 * 1024 * 1024),
    allowedMimeTypes: listEnv(
      'ATTACHMENT_ALLOWED_MIME_TYPES',
      'application/pdf,image/png,image/jpeg,text/plain',
    ),
    allowedExtensions: listEnv(
      'ATTACHMENT_ALLOWED_EXTENSIONS',
      '.pdf,.png,.jpg,.jpeg,.txt',
    ),
  };
}
