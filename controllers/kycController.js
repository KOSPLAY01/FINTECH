import sql from '../config/db.js';
import uploadImage from '../utils/uploadImage.js';
import cloudinary from '../config/cloudinary.js';
import fs from 'fs';

export const submitKYC = async (req, res) => {
  const { fullName, bvn, nin, idType, idNumber, tierRequested } = req.body;

  if (!tierRequested || !['tier_2', 'tier_3'].includes(tierRequested)) {
    return res.status(400).json({ error: 'Invalid or missing tierRequested (tier_2 or tier_3)' });
  }

  if (!bvn || !nin) {
    return res.status(400).json({ error: 'BVN and NIN are required' });
  }

  try {
    // Fetch current user tier
    const wallet = await sql`SELECT tier FROM wallets WHERE user_id = ${req.user.id}`;
    if (!wallet[0]) return res.status(404).json({ error: 'Wallet not found' });

    const currentTier = wallet[0].tier;

    let idImageUrl = null;
    let utilityBillUrl = null;

    if (tierRequested === 'tier_3') {
      if (!idType || !idNumber) {
        return res.status(400).json({ error: 'ID type and ID number are required for Tier 3' });
      }

      if (!req.files || !req.files.idImage) {
        return res.status(400).json({ error: 'ID image is required for Tier 3' });
      }

      idImageUrl = await uploadImage(req.files.idImage[0], cloudinary, fs);

      if (!req.files.utilityBill) {
        return res.status(400).json({ error: 'Utility bill is required for Tier 3' });
      }

      utilityBillUrl = await uploadImage(req.files.utilityBill[0], cloudinary, fs);
    }

    const kyc = await sql`
      INSERT INTO kyc_submissions (
        user_id, full_name, bvn, nin, id_type, id_number,
        id_image_url, utility_bill_url, current_tier, tier_requested
      )
      VALUES (
        ${req.user.id}, ${fullName || null}, ${bvn}, ${nin},
        ${tierRequested === 'tier_3' ? idType : null},
        ${tierRequested === 'tier_3' ? idNumber : null},
        ${idImageUrl}, ${utilityBillUrl},
        ${currentTier}, ${tierRequested}
      )
      RETURNING *
    `;

    res.status(201).json({ message: 'KYC submitted successfully', kyc: kyc[0] });

  } catch (err) {
    console.error('KYC submission error:', err);
    res.status(500).json({ error: err.message });
  }
};
