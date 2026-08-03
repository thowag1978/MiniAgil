# Attachments API

All routes require `Authorization: Bearer <token>`.

- `GET /api/items/:itemId/attachments` returns `{ data, permissions: { canUpload } }` for users with project access. Each record includes `canDelete`; internal bucket/object keys and signed URLs are not returned.
- `POST /api/items/:itemId/attachments` accepts one `multipart/form-data` field named `file`. Project edit permission is required. Size, extension, declared MIME type, and known file signatures are validated before storage.
- `GET /api/attachments/:attachmentId/download` returns `{ url, expiresInSeconds }` only after project authorization. The URL is generated on demand and is never persisted.
- `DELETE /api/attachments/:attachmentId` is available to the uploader, project owner/admin, or global admin.

Deletion strategy: metadata is soft-deleted and the private MinIO object is retained for audit/recovery. Upload and history persistence are transactional in MySQL; if persistence fails after upload, the newly created object is removed as compensation.

Limits and allowed types are configured with `ATTACHMENT_MAX_SIZE_BYTES`, `ATTACHMENT_ALLOWED_MIME_TYPES`, and `ATTACHMENT_ALLOWED_EXTENSIONS`.
