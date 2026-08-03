# Watchers and notifications API

All routes require authentication. Item watcher routes also require current access to the item's project.

- `POST /api/items/:itemId/watchers/me`: follows an item; idempotent.
- `DELETE /api/items/:itemId/watchers/me`: stops following an item; idempotent.
- `GET /api/items/:itemId/watchers`: lists item watchers.
- `GET /api/notifications?page=1&limit=20`: lists the current user's accessible notifications, newest first.
- `GET /api/notifications/unread-count`: counts unread accessible notifications.
- `PATCH /api/notifications/:id/read`: marks one owned and accessible notification as read.
- `PATCH /api/notifications/read-all`: marks all owned and accessible notifications as read.

Comment authors automatically follow the item. Notifications for assignment, new comments, and status changes are derived from the same central history events; the action author is excluded. No email or WebSocket delivery is performed.
