import sql from '../config/db.js';

// Get all pending KYC submissions
export const getPendingKYC = async (req, res) => {
  try {
    const submissions = await sql`
      SELECT k.*, u.email, u.name FROM kyc_submissions k
      JOIN users u ON u.id = k.user_id
      WHERE k.status = 'PENDING'
      ORDER BY k.created_at DESC
    `;
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Approve a KYC submission and upgrade wallet tier
export const approveKYC = async (req, res) => {
  const { kycId } = req.params;

  try {
    const kyc = await sql`SELECT * FROM kyc_submissions WHERE id = ${kycId}`;
    if (!kyc[0]) return res.status(404).json({ error: 'KYC record not found' });

    // Update wallet tier
    await sql`UPDATE wallets SET tier = ${kyc[0].tier_requested} WHERE user_id = ${kyc[0].user_id}`;

    // Approve KYC
    await sql`UPDATE kyc_submissions SET status = 'APPROVED', updated_at = NOW() WHERE id = ${kycId}`;

    res.json({ message: 'KYC approved and wallet tier upgraded' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// Reject a KYC submission
export const rejectKYC = async (req, res) => {
  const { kycId } = req.params;

  try {
    const result = await sql`
      UPDATE kyc_submissions
      SET status = 'REJECTED', updated_at = NOW()
      WHERE id = ${kycId}
      RETURNING *
    `;
    if (result.length === 0) return res.status(404).json({ error: 'KYC record not found' });

    res.json({ message: 'KYC rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all users with wallet account number and tier
export const getAllUsers = async (req, res) => {
  try {
    const users = await sql`
      SELECT 
        users.id, 
        users.name, 
        users.email, 
        wallets.monnify_account_number AS account_number, 
        wallets.tier, 
        users.created_at
      FROM users
      JOIN wallets ON wallets.user_id = users.id
      ORDER BY users.created_at DESC
    `;

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// Get all transactions with user info
export const getAllTransactions = async (req, res) => {
  try {
    const transactions = await sql`
      SELECT 
        t.*, 
        u.email, 
        u.name 
      FROM transactions t
      JOIN wallets w ON w.id = t.wallet_id
      JOIN users u ON u.id = w.user_id
      ORDER BY t.created_at DESC
    `;

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


