import { extname } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { getAttachmentConfig } from '../../infrastructure/storageConfig';

const config = getAttachmentConfig();
const mimeExtensions: Record<string, Set<string>> = {
  'application/pdf': new Set(['.pdf']),
  'image/png': new Set(['.png']),
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'text/plain': new Set(['.txt']),
};

function uploadError(message: string, status: number) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: config.maxSizeBytes },
  fileFilter: (_req, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    const matchingExtensions = mimeExtensions[mimeType];
    if (
      !config.allowedMimeTypes.has(mimeType)
      || !config.allowedExtensions.has(extension)
      || (matchingExtensions && !matchingExtensions.has(extension))
    ) {
      return callback(uploadError('Attachment type is not allowed', 415));
    }
    callback(null, true);
  },
}).single('file');

export function validateFileContent(file: Express.Multer.File) {
  const buffer = file.buffer;
  switch (file.mimetype.toLowerCase()) {
    case 'application/pdf':
      return buffer.subarray(0, 4).toString() === '%PDF';
    case 'image/png':
      return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case 'image/jpeg':
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'text/plain':
      return !buffer.includes(0);
    default:
      return true;
  }
}

export function attachmentUpload(req: Request, res: Response, next: NextFunction) {
  multerUpload(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(uploadError(`Attachment exceeds the maximum size of ${config.maxSizeBytes} bytes`, 413));
    }
    if (error) return next(error);
    next();
  });
}
