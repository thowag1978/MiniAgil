import dotenv from 'dotenv';
import { createApp } from './app';

dotenv.config({ override: true });

const app = createApp();
const PORT = Number(process.env.API_PORT || 4000);

app.listen(PORT, () => {
  console.log(`MiniAgil API is running on http://localhost:${PORT}`);
});
