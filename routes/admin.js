import express from 'express';
import auth from '../middleware/auth.js';
import isAdmin from '../middleware/isAdmin.js';
import {
  getPendingKYC,
  approveKYC,
  rejectKYC,
  getAllUsers,
  getAllTransactions
} from '../controllers/adminController.js';


/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management and KYC review
 */
const router = express.Router();

/**
 * @swagger
 * /api/admin/kyc/pending:
 *   get:
 *     summary: Get all pending KYC requests
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending KYC requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   fullName:
 *                     type: string
 *                   status:
 *                     type: string
 *                     example: pending
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/admin/kyc/approve/{kycId}:
 *   post:
 *     summary: Approve a KYC request
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kycId
 *         required: true
 *         schema:
 *           type: string
 *         description: The KYC ID to approve
 *     responses:
 *       200:
 *         description: KYC approved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: KYC approved
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/admin/kyc/reject/{kycId}:
 *   post:
 *     summary: Reject a KYC request
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kycId
 *         required: true
 *         schema:
 *           type: string
 *         description: The KYC ID to reject
 *     responses:
 *       200:
 *         description: KYC rejected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: KYC rejected
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/admin/users/transactions:
 *   get:
 *     summary: Get all user transactions
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   userId:
 *                     type: string
 *                   amount:
 *                     type: number
 *                   type:
 *                     type: string
 *                   status:
 *                     type: string
 *       401:
 *         description: Unauthorized
 */

router.use(auth, isAdmin); // Protect all admin routes


router.get('/kyc/pending', getPendingKYC);
router.post('/kyc/approve/:kycId', approveKYC);
router.post('/kyc/reject/:kycId', rejectKYC);
router.get('/users', getAllUsers);
router.get('/users/transactions', getAllTransactions);

export default router;
