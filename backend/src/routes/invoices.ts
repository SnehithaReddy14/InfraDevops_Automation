import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {
  uploadInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  handleBulkAction,
  getDashboardStats,
  queryAssistant,
  exportInvoices,
  extractInvoiceOnly
} from '../controllers/invoiceController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, PNG, JPG, and JPEG files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Protect all invoice routes
router.use(authenticateToken);

router.post('/upload', upload.single('invoice'), uploadInvoice);
router.post('/extract', upload.single('invoice'), extractInvoiceOnly);
router.get('/', getInvoices);
router.get('/dashboard-stats', getDashboardStats);
router.post('/assistant-query', queryAssistant);
router.get('/export', exportInvoices);
router.post('/bulk', handleBulkAction);

router.get('/:id', getInvoiceById);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);

export default router;
