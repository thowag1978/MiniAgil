import dotenv from 'dotenv';
import { createApp } from './app';

dotenv.config();

const app = createApp();
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`MiniAgil API is running on http://localhost:${PORT}`);
});
