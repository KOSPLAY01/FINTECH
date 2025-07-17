import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/auth.js';
import walletRoutes from './routes/wallet.js';
import kycRoutes from './routes/kyc.js';
import adminRoutes from './routes/admin.js';

import {
  handleMonnifyWebhook,
  handleMonnifyDisbursementWebhook
} from './controllers/walletController.js';

import { swaggerSpec } from './config/swagger.js';

const app = express();

// === Webhooks ===

// Handle Monnify Reserved Account Funding Webhook
app.post('/webhook/monnify', express.raw({ type: 'application/json' }), (req, res, next) => {
  try {
    req.body = JSON.parse(req.body.toString('utf8'));
    next();
  } catch (err) {
    console.error('Invalid JSON in /webhook/monnify:', err);
    res.status(400).json({ error: 'Invalid JSON' });
  }
}, handleMonnifyWebhook);

// Handle Monnify Disbursement (Bank Transfer) Webhook
app.post('/webhook/monnify-disbursement', express.raw({ type: 'application/json' }), (req, res, next) => {
  try {
    req.body = JSON.parse(req.body.toString('utf8'));
    next();
  } catch (err) {
    console.error('Invalid JSON in /webhook/monnify-disbursement:', err);
    res.status(400).json({ error: 'Invalid JSON' });
  }
}, handleMonnifyDisbursementWebhook);


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// === Swagger Docs ===
app.get('/docs', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Fintech API Docs</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
        <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-standalone-preset.js"></script>
        <script>
          window.onload = () => {
            SwaggerUIBundle({
              url: '/swagger.json',
              dom_id: '#swagger-ui',
              presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
              layout: "BaseLayout"
            });
          };
        </script>
      </body>
    </html>
  `);
});

app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(swaggerSpec);
});

// === Welcome Route ===
app.get('/', (req, res) => {
  res.send('WELCOME TO FINFLOW API');
});

// === API Routes ===
app.use('/', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/admin', adminRoutes);

// === Global 404 Handler ===
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// === Server Init ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
