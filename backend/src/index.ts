import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Polyfill DOM globals for pdf-parse serverless compatibility
if (typeof global !== 'undefined') {
  if (!(global as any).DOMMatrix) {
    (global as any).DOMMatrix = class DOMMatrix {};
  }
  if (!(global as any).ImageData) {
    (global as any).ImageData = class ImageData {};
  }
  if (!(global as any).Path2D) {
    (global as any).Path2D = class Path2D {};
  }
}

// Load environment variables
dotenv.config();

import authRoutes from './routes/auth';
import invoiceRoutes from './routes/invoices';
import projectRoutes from './routes/projects';
import pricingRoutes from './routes/pricing';
import { startExchangeRateRefresh, ensureFreshExchangeRate, getInrPerUsd } from './services/exchangeRateService';

const app = express();
const PORT = process.env.PORT || 5000;

// Security and CORS middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Allow displaying uploaded files in frontend browser
    frameguard: false,                // Allow embedding pdfs in cross-port iframe
    contentSecurityPolicy: false,     // Disable default CSP to allow pdf reader modules
  })
);
app.use(
  cors({
    origin: '*', // Allow all origins for dev simplicity
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === 'localhost',
});

app.use('/api/', apiLimiter);

// Serve uploads folder statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes mounting
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/pricing', pricingRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

app.get('/api/exchange-rate', async (_req, res) => {
  try {
    const inrPerUsd = await ensureFreshExchangeRate();
    res.status(200).json({ inrPerUsd, source: 'live' });
  } catch {
    res.status(200).json({ inrPerUsd: getInrPerUsd(), source: 'fallback' });
  }
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Express Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Server] Enterprise Invoice Platform listening on http://localhost:${PORT}`);
    startExchangeRateRefresh();
  });
} else {
  startExchangeRateRefresh();
}

export default app;
