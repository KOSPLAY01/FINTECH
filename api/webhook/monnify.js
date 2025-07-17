import { handleMonnifyWebhook } from '../../controllers/walletController.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let rawBody = '';
  req.on('data', chunk => { rawBody += chunk; });
  req.on('end', async () => {
    try {
      req.body = JSON.parse(rawBody);
      await handleMonnifyWebhook(req, res);
    } catch (err) {
      console.error('Monnify Webhook Error:', err);
      res.status(400).json({ error: 'Invalid JSON' });
    }
  });
}
