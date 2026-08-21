import express from 'express';
import {
  getFinanceSummary,
  getTransactions,
  getDebtors,
  collectDebtorPayment,
  processRefund,
  getActiveCashDrawer,
  openCashDrawer,
  closeCashDrawer,
  exportFinancialTransactions
} from '../controllers/paymentController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';

const router = express.Router();

// Enforce auth across all finance endpoints
router.use(requireAuth);

// ── Summary & Metrics ──
router.get('/summary', getFinanceSummary);

// ── Transaction Ledger ──
router.get('/transactions', getTransactions);

// ── Debtors / Credit Khata ──
router.get('/debtors', getDebtors);
router.post('/debtors/:id/collect', collectDebtorPayment);

// ── Refunds ──
router.post('/payments/:id/refund', requireRole('admin'), processRefund);

// ── Cash Drawer Management ──
router.get('/cash-drawer', getActiveCashDrawer);
router.post('/cash-drawer/open', openCashDrawer);
router.post('/cash-drawer/close', closeCashDrawer);

// ── Server-side CSV Export ──
router.get('/export', exportFinancialTransactions);

export default router;
