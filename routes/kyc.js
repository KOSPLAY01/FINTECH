
// routes/kyc.js
import express from 'express';
import auth from '../middleware/auth.js';
import multer from 'multer';
import { submitKYC } from '../controllers/kycController.js';


/**
 * @swagger
 * tags:
 *   name: KYC
 *   description: Know Your Customer (KYC) submission and verification
 */
const router = express.Router();
const upload = multer({ dest: 'uploads/' });

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
 *               - idType
 *               - idNumber
 *               - tierRequested
 *               - idImage
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
 *               idType:
 *                 type: string
 *                 example: NIN
 *               idNumber:
 *                 type: string
 *                 example: A1234567
 *               tierRequested:
 *                 type: string
 *                 example: tier_2
 *               idImage:
 *                 type: string
 *                 format: binary
 *               utilityBill:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: KYC submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: KYC submitted
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
    { name: 'utilityBill', maxCount: 1 } // Optional unless Tier 3
  ]),
  submitKYC
);

export default router;
