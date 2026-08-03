import 'dotenv/config';
import { createApp } from './app';
import { registerWebhookEventHandler, startWebhookWorker } from './services/webhooks';

const app = createApp();
const PORT = Number(process.env.API_PORT || 4000);
registerWebhookEventHandler();
startWebhookWorker();

app.listen(PORT, () => {
  console.log(`MiniAgil API is running on http://localhost:${PORT}`);
});
