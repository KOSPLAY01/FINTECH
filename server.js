import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/auth.js';

import { swaggerUi, swaggerSpec } from './config/swagger.js';

const app = express();
app.use((req, res, next) => {
  if (req.originalUrl === '/payments/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Swagger API docs route
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('WELCOME TO FINTECH API');
});

app.use('/', authRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});