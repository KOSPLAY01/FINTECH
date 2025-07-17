import fetch from 'node-fetch';
import crypto from 'crypto';
import axios from 'axios';
import {
  API_KEY,
  CLIENT_SECRET,
  CONTRACT_CODE,
} from '../config/monnify.js';


let monnifyToken = null;
let monnifyTokenExpiry = null;

//  Get Monnify Token (Cached)
export const getMonnifyToken = async () => {
  if (monnifyToken && monnifyTokenExpiry > Date.now()) return monnifyToken;

  const res = await fetch(`${process.env.MONNIFY_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${API_KEY}:${CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/json'
    }
  });

  const data = await res.json();
  if (!data.responseBody?.accessToken) {
    throw new Error('Failed to fetch Monnify token: ' + JSON.stringify(data));
  }

  monnifyToken = data.responseBody.accessToken;
  monnifyTokenExpiry = Date.now() + 50 * 60 * 1000;
  return monnifyToken;
};

//  Verify Monnify Webhook Signature
export const verifyMonnifySignature = (payload, headerSignature) => {
  const generated = crypto
    .createHmac('sha512', CLIENT_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  return generated === headerSignature;
};

//  Create Reserved Account
export const createReservedAccount = async (user) => {
  const token = await getMonnifyToken();

  const res = await fetch(`${process.env.MONNIFY_BASE_URL}/api/v2/bank-transfer/reserved-accounts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      accountReference: `wallet_${user.id}`,
      accountName: user.name,
      currencyCode: 'NGN',
      contractCode: CONTRACT_CODE,
      customerEmail: user.email,
      customerName: user.name,
      getAllAvailableBanks: true
    })
  });

  const data = await res.json();
  if (!data.responseBody?.accounts?.[0]) {
    throw new Error('Failed to create reserved account: ' + JSON.stringify(data));
  }

  return {
    bankName: data.responseBody.accounts[0].bankName,
    accountNumber: data.responseBody.accounts[0].accountNumber
  };
};

// Generate Payment Link (for deposits)
export const generatePaymentLink = async ({ amount, user }) => {
  const token = await getMonnifyToken();
  const reference = `wallet_topup_${user.id}_${Date.now()}`;

  const res = await fetch(`${process.env.MONNIFY_BASE_URL}/api/v1/merchant/transactions/init-transaction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount,
      customerName: user.name,
      customerEmail: user.email,
      paymentReference: reference,
      paymentDescription: 'Wallet top-up',
      currencyCode: 'NGN',
      contractCode: CONTRACT_CODE,
      redirectUrl: process.env.MONNIFY_REDIRECT_URL,
      paymentMethods: ['ACCOUNT_TRANSFER', 'CARD']
    })
  });

  const data = await res.json();

  if (!data.requestSuccessful || !data.responseBody?.checkoutUrl) {
    throw new Error('Monnify error: ' + (data.responseMessage || 'Unable to generate payment link'));
  }

  return { paymentLink: data.responseBody.checkoutUrl, reference };
};

// Fetch Banks
export const fetchBanks = async () => {
  const token = await getMonnifyToken();

  const response = await axios.get(`${process.env.MONNIFY_BASE_URL}/api/v1/banks`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const banks = response.data?.responseBody;
  if (!Array.isArray(banks)) throw new Error('Failed to fetch banks');

  return banks;
};

//  Get Bank NIP Code by Name
export const getBankCodeByName = async (bankName) => {
  const banks = await fetchBanks();
  const lower = bankName.toLowerCase();

  let bank = banks.find(b => b.name.toLowerCase() === lower);
  if (!bank) bank = banks.find(b => b.name.toLowerCase().includes(lower));

  if (!bank) throw new Error(`Invalid bank name: ${bankName}`);

  return bank.nipBankCode;
};

//  Initiate Single Transfer —  Monnify Disbursement v2
export const initiateBankTransferV2 = async ({ amount, destinationAccountNumber, destinationBankCode, narration, reference, sourceAccountNumber }) => {
  const token = await getMonnifyToken();

  const { data } = await axios.post(`${process.env.MONNIFY_BASE_URL}/api/v2/disbursements/single`, {
    amount,
    reference,
    narration: narration || 'Wallet Transfer',
    destinationBankCode,
    destinationAccountNumber,
    currency: 'NGN',
    sourceAccountNumber
  }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!data.requestSuccessful) {
    throw new Error('Monnify v2 Transfer Failed: ' + JSON.stringify(data));
  }

  return data.responseBody;
};
