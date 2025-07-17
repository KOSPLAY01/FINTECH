import express from 'express';
import auth from '../middleware/auth.js';
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

import { submitKYC } from '../controllers/kycController.js';

const router = express.Router();

/**
 * @swagger
 * /api/kyc/submit:
 *   post:
 *     summary: Submit KYC documents
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - bvn
 *               - nin
 *               - tierRequested
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: John Doe
 *               bvn:
 *                 type: string
 *                 example: "12345678901"
 *               nin:
 *                 type: string
 *                 example: "12345678901"
 *               tierRequested:
 *                 type: string
 *                 enum: [tier_2, tier_3]
 *                 example: tier_2
 *               idType:
 *                 type: string
 *                 example: National ID
 *               idNumber:
 *                 type: string
 *                 example: A1234567
 *               idImage:
 *                 type: string
 *                 format: binary
 *               utilityBill:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: KYC submitted successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/submit',
  auth,
  upload.fields([
    { name: 'idImage', maxCount: 1 },
    { name: 'utilityBill', maxCount: 1 }
  ]),
  submitKYC
);

export default router;
