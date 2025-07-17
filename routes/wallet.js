import express from 'express';
import {
  getWallet,
  transferToUser,
  fundAccount,
  getTransactions,
  transferToBank,
  authorizeBankTransfer
} from '../controllers/walletController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: Wallet management and transactions
/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: Wallet management and transactions
 */

/**
 * @swagger
 * /api/wallet/:
 *   get:
 *     summary: Get wallet details for the authenticated user
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: number
 *                   example: 5000
 *                 currency:
 *                   type: string
 *                   example: NGN
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/wallet/fund:
 *   post:
 *     summary: Fund wallet
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 1000
 *     responses:
 *       200:
 *         description: Wallet funded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Wallet funded
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/wallet/transactions:
 *   get:
 *     summary: Get wallet transaction history
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: tx_12345
 *                   type:
 *                     type: string
 *                     example: fund
 *                   amount:
 *                     type: number
 *                     example: 1000
 *                   status:
 *                     type: string
 *                     example: successful
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/wallet/transfer:
 *   post:
 *     summary: Transfer funds to another user
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountNumber
 *               - bank
 *               - amount
 *             properties:
 *               accountNumber:
 *                 type: string
 *                 example: "1234567890"
 *               bank:
 *                 type: string
 *                 example: "Wema Bank"
 *               amount:
 *                 type: number
 *                 example: 1000
 *     responses:
 *       200:
 *         description: Transfer successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Transfer completed
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/wallet/bank/authorize:
 *   post:
 *     summary: Authorize a bank transfer with OTP
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reference
 *               - otp
 *             properties:
 *               reference:
 *                 type: string
 *                 example: "bank_transfer_10_1752750730868"
 *               otp:
 *                 type: string
 *                 example: "772438"
 *     responses:
 *       200:
 *         description: Bank transfer authorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Transfer authorized
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/wallet/bank-transfer:
 *   post:
 *     summary: Transfer funds to external bank account
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountNumber
 *               - bankName
 *               - amount
 *             properties:
 *               accountNumber:
 *                 type: string
 *                 example: "1234567890"
 *               bankName:
 *                 type: string
 *                 example: "Wema Bank"
 *               amount:
 *                 type: number
 *                 example: 1000
 *               narration:
 *                 type: string
 *                 example: "Payment for service"
 *     responses:
 *       200:
 *         description: Bank transfer successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/bank/authorize', authorizeBankTransfer);
router.post('/bank-transfer', auth, transferToBank);



/**
 * @swagger
 * /api/wallet/bank-transfer:
 *   post:
 *     summary: Transfer funds to external bank account
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountNumber
 *               - bankName
 *               - amount
 *             properties:
 *               accountNumber:
 *                 type: string
 *                 example: "1234567890"
 *               bankName:
 *                 type: string
 *                 example: "Wema Bank"
 *               amount:
 *                 type: number
 *                 example: 1000
 *               narration:
 *                 type: string
 *                 example: "Payment for service"
 *     responses:
 *       200:
 *         description: Bank transfer successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */


export default router;
