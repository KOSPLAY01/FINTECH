import sql from '../config/db.js';
import { getTierLimits } from '../utils/tierLimits.js';
import {
  generatePaymentLink,
  verifyMonnifySignature,
  initiateBankTransferV2,
  getBankCodeByName
} from '../utils/monnifyHelper.js';
import axios from 'axios';
import { getMonnifyToken } from '../utils/monnifyHelper.js';

// Get Wallet
export const getWallet = async (req, res) => {
  const wallet = await sql`SELECT * FROM wallets WHERE user_id = ${req.user.id}`;
  res.json(wallet[0]);
};

// Internal Transfer to Another User
export const transferToUser = async (req, res) => {
  const { accountNumber, bank, amount } = req.body;
  if (!accountNumber || !bank || !amount) {
    return res.status(400).json({ error: 'Missing fields: accountNumber, bank, amount' });
  }

  try {
    const receiver = await sql`
      SELECT * FROM wallets 
      WHERE monnify_account_number = ${accountNumber} 
      AND monnify_bank_name = ${bank}
    `;
    if (!receiver[0]) return res.status(404).json({ error: 'Recipient wallet not found' });

    const sender = await sql`SELECT * FROM wallets WHERE user_id = ${req.user.id}`;
    if (!sender[0]) return res.status(404).json({ error: 'Sender wallet not found' });

    if (sender[0].balance < amount) return res.status(400).json({ error: 'Insufficient funds' });

    const senderLimits = getTierLimits(sender[0].tier);
    const receiverLimits = getTierLimits(receiver[0].tier);

    const todayTransfer = await sql`
      SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
      WHERE wallet_id = ${sender[0].id} AND type = 'TRANSFER' AND created_at::date = CURRENT_DATE
    `;

    if (parseFloat(todayTransfer[0].total) + amount > senderLimits.dailyLimit)
      return res.status(400).json({ error: `Exceeds daily limit for ${sender[0].tier}` });

    if ((receiver[0].balance + amount) > receiverLimits.maxBalance)
      return res.status(400).json({ error: `Recipient wallet will exceed max balance for ${receiver[0].tier}` });

    await sql`BEGIN`;

    await sql`UPDATE wallets SET balance = balance - ${amount} WHERE id = ${sender[0].id}`;
    await sql`UPDATE wallets SET balance = balance + ${amount} WHERE id = ${receiver[0].id}`;

    await sql`
      INSERT INTO transactions (wallet_id, amount, type, status, description)
      VALUES (${sender[0].id}, ${amount}, 'TRANSFER', 'SUCCESS', ${`Sent to ${accountNumber} (${bank})`})
    `;

    await sql`
      INSERT INTO transactions (wallet_id, amount, type, status, description)
      VALUES (${receiver[0].id}, ${amount}, 'DEPOSIT', 'SUCCESS', ${`Received from user ${req.user.id}`})
    `;

    await sql`COMMIT`;

    res.json({ message: 'Transfer successful' });

  } catch (err) {
    await sql`ROLLBACK`;
    console.error('Transfer error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Bank Transfer using Monnify V2 Single Transfer — Leaves Status as PENDING
export const transferToBank = async (req, res) => {
  const { accountNumber, bankName, amount, narration } = req.body;
  if (!accountNumber || !bankName || !amount) {
    return res.status(400).json({ error: 'Missing fields: accountNumber, bankName, amount' });
  }

  try {
    const sender = await sql`SELECT * FROM wallets WHERE user_id = ${req.user.id}`;
    if (!sender[0]) return res.status(404).json({ error: 'Sender wallet not found' });

    if (sender[0].balance < amount) return res.status(400).json({ error: 'Insufficient funds' });

    const senderLimits = getTierLimits(sender[0].tier);
    const todayTransfer = await sql`
      SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
      WHERE wallet_id = ${sender[0].id} AND type = 'BANK_TRANSFER' AND created_at::date = CURRENT_DATE
    `;

    if (parseFloat(todayTransfer[0].total) + amount > senderLimits.dailyLimit)
      return res.status(400).json({ error: `Exceeds daily limit for ${sender[0].tier}` });

    let bankCode;
    try {
      bankCode = await getBankCodeByName(bankName);
    } catch (err) {
      return res.status(400).json({ error: `Invalid bank name: ${bankName}` });
    }

    const reference = `bank_transfer_${req.user.id}_${Date.now()}`;
    await sql`BEGIN`;
    await sql`UPDATE wallets SET balance = balance - ${amount} WHERE id = ${sender[0].id}`;
    await sql`
      INSERT INTO transactions (wallet_id, amount, type, reference, status, description)
      VALUES (${sender[0].id}, ${amount}, 'BANK_TRANSFER', ${reference}, 'PENDING', ${`Bank Transfer to ${accountNumber} (${bankName})`})
    `;
    await sql`COMMIT`;

    try {
      const transferResult = await initiateBankTransferV2({
        amount,
        destinationAccountNumber: accountNumber,
        destinationBankCode: bankCode,
        narration: narration || 'Wallet Transfer',
        reference,
        sourceAccountNumber: process.env.MONNIFY_SOURCE_ACCOUNT_NUMBER
      });

      // ✅ Don't update transaction status here, webhook will handle it
      res.json({ message: 'Bank transfer initiated successfully', transferResult });

    } catch (monnifyError) {
      console.error('Monnify Transfer Error:', monnifyError.response?.data || monnifyError.message);

      await sql`BEGIN`;
      await sql`UPDATE wallets SET balance = balance + ${amount} WHERE id = ${sender[0].id}`;
      await sql`
        UPDATE transactions
        SET status = 'FAILED', description = ${`Bank Transfer Failed: ${monnifyError.response?.data?.responseMessage || monnifyError.message}`}
        WHERE reference = ${reference}
      `;
      await sql`COMMIT`;

      res.status(500).json({
        error: 'Bank transfer failed',
        details: monnifyError.response?.data || monnifyError.message
      });
    }

  } catch (err) {
    await sql`ROLLBACK`.catch(() => { });
    console.error('Bank Transfer Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Authorize Bank Transfer with OTP
export const authorizeBankTransfer = async (req, res) => {
  const { reference, authorizationCode } = req.body;
  if (!reference || !authorizationCode) {
    return res.status(400).json({ error: 'Missing reference or OTP' });
  }

  try {
    const token = await getMonnifyToken();

    const { data } = await axios.post(`${process.env.process.env.MONNIFY_BASE_URL}/api/v2/disbursements/single/validate-otp`, {
      reference,
      authorizationCode
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!data.requestSuccessful) {
      return res.status(400).json({ error: 'OTP Authorization Failed', details: data });
    }

    res.status(200).json({ message: 'Bank transfer authorized successfully', data: data.responseBody });

  } catch (err) {
    console.error('Authorize Transfer Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to authorize transfer', details: err.response?.data || err.message });
  }
};


// Monnify Webhook for Fund Account
export const handleMonnifyWebhook = async (req, res) => {
  try {
    const signature = req.headers['monnify-signature'];
    const body = req.body;

    console.log('Webhook received:', JSON.stringify(body));

    const isValid = verifyMonnifySignature(body, signature);
    if (!isValid) return res.status(403).json({ error: 'Invalid signature' });

    const payload = body.eventData;
    const { paymentReference, amountPaid, paymentStatus } = payload;

    if (paymentStatus !== 'PAID') return res.status(200).json({ message: 'Ignored non-paid status' });

    const existingTx = await sql`SELECT * FROM transactions WHERE reference = ${paymentReference}`;
    if (!existingTx[0]) return res.status(404).json({ error: 'Transaction not found' });

    const walletId = existingTx[0].wallet_id;
    await sql`BEGIN`;
    await sql`UPDATE wallets SET balance = balance + ${amountPaid} WHERE id = ${walletId}`;
    await sql`
      UPDATE transactions
      SET status = 'SUCCESS', description = 'Monnify deposit confirmed'
      WHERE id = ${existingTx[0].id}
    `;
    await sql`COMMIT`;

    res.status(200).json({ message: 'Webhook processed successfully' });

  } catch (err) {
    await sql`ROLLBACK`.catch(() => { });
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Monnify Disbursement Webhook Handler
export const handleMonnifyDisbursementWebhook = async (req, res) => {
  try {
    const signature = req.headers['monnify-signature'];
    const body = req.body;

    console.log('Disbursement Webhook:', JSON.stringify(body));

    const isValid = verifyMonnifySignature(body, signature);
    if (!isValid) return res.status(403).json({ error: 'Invalid signature' });

    const { reference, amount, status } = body.eventData;

    const existingTx = await sql`SELECT * FROM transactions WHERE reference = ${reference}`;
    if (!existingTx[0]) return res.status(404).json({ error: 'Transaction not found' });

    const tx = existingTx[0];
    await sql`BEGIN`;

    if (['PAID', 'SUCCESS', 'SUCCESSFUL'].includes(status)) {
      await sql`UPDATE transactions SET status = 'SUCCESS', description = 'Disbursement successful' WHERE id = ${tx.id}`;
    } else if (status === 'FAILED') {
      await sql`UPDATE transactions SET status = 'FAILED', description = 'Disbursement failed by Monnify' WHERE id = ${tx.id}`;
      await sql`UPDATE wallets SET balance = balance + ${amount} WHERE id = ${tx.wallet_id}`;
    }

    await sql`COMMIT`;
    res.status(200).json({ message: 'Disbursement webhook handled' });

  } catch (err) {
    await sql`ROLLBACK`.catch(() => { });
    console.error('Disbursement webhook error:', err);
    res.status(500).json({ error: err.message });
  }
};


// Fund Wallet (Generate Payment Link)
export const fundAccount = async (req, res) => {
  const { amount } = req.body;
  if (!amount) return res.status(400).json({ error: 'Missing amount' });

  try {
    const wallet = await sql`SELECT * FROM wallets WHERE user_id = ${req.user.id}`;
    if (!wallet[0]) return res.status(404).json({ error: 'Wallet not found' });

    const limits = getTierLimits(wallet[0].tier);
    if ((wallet[0].balance + amount) > limits.maxBalance)
      return res.status(400).json({ error: `Deposit would exceed max balance for ${wallet[0].tier}` });

    const { paymentLink, reference } = await generatePaymentLink({ amount, user: req.user });

    await sql`
      INSERT INTO transactions (wallet_id, amount, type, reference, status, description)
      VALUES (${wallet[0].id}, ${amount}, 'DEPOSIT', ${reference}, 'PENDING', 'Monnify top-up initiated')
    `;

    res.status(200).json({ paymentLink, reference });

  } catch (err) {
    console.error('Fund account error:', err);
    res.status(500).json({ error: 'Unable to initiate top-up' });
  }
};

// Get All Transactions for a User
export const getTransactions = async (req, res) => {
  try {
    const wallet = await sql`SELECT id FROM wallets WHERE user_id = ${req.user.id}`;
    if (!wallet[0]) return res.status(404).json({ error: 'Wallet not found' });

    const transactions = await sql`
      SELECT * FROM transactions
      WHERE wallet_id = ${wallet[0].id}
      ORDER BY created_at DESC
    `;

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
