import sql from '../config/db.js';
import uploadImage from '../utils/uploadImage.js';
import cloudinary from '../config/cloudinary.js';

export const submitKYC = async (req, res) => {
  const {
    fullName,
    bvn,
    nin,
    idType,
    idNumber,
    tierRequested
  } = req.body;

  if (!tierRequested || !['tier_2', 'tier_3'].includes(tierRequested)) {
    return res.status(400).json({ error: 'Invalid or missing tierRequested (tier_2 or tier_3)' });
  }

  try {
    let idImageUrl = null;
    let utilityBillUrl = null;

    if (tierRequested === 'tier_3') {
      if (!req.files?.idImage || !req.files?.utilityBill) {
        return res.status(400).json({ error: 'ID Image and Utility Bill are required for Tier 3' });
      }

      idImageUrl = await uploadImage(req.files.idImage[0], cloudinary);
      utilityBillUrl = await uploadImage(req.files.utilityBill[0], cloudinary);
    }

    const kyc = await sql`
      INSERT INTO kyc_submissions (
        user_id, full_name, bvn, nin, id_type, id_number,
        id_image_url, utility_bill_url, tier_requested
      )
      VALUES (
        ${req.user.id}, ${fullName}, ${bvn}, ${nin}, ${idType || null}, ${idNumber || null},
        ${idImageUrl}, ${utilityBillUrl}, ${tierRequested}
      )
      RETURNING *
    `;

    res.status(201).json({ message: 'KYC submitted successfully', kyc: kyc[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
