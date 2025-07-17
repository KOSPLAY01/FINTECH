
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import sql from '../config/db.js';
import transporter from '../config/mailer.js';
import cloudinary from '../config/cloudinary.js';
import uploadImage from '../utils/uploadImage.js';
import fs from 'fs';
import redis from '../config/redis.js';
import { createReservedAccount } from '../utils/monnifyHelper.js'; 



const generateToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

export const register = async (req, res) => {
  const { email, password, name, phoneNumber, role = 'customer' } = req.body;
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!email || !password || !name) return res.status(400).json({ error: 'All fields are required' });
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadImage(req.file, cloudinary, fs);
    }
    const existingUser = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (existingUser.length > 0) return res.status(400).json({ error: 'Email already registered' });
    const insertedUser = await sql`
      INSERT INTO users (email, password, name, profile_image_url, phone_number, role)
      VALUES (${email}, ${hashedPassword}, ${name}, ${imageUrl}, ${phoneNumber}, ${role})
      RETURNING *
    `;
    const user = insertedUser[0];

    // Check if wallet already exists for this user (should not, but for Monnify safety)
    const existingWallets = await sql`SELECT * FROM wallets WHERE user_id = ${user.id}`;
    let monnifyAccount;
    if (existingWallets.length > 0) {
      // Use existing wallet info
      monnifyAccount = {
        accountNumber: existingWallets[0].monnify_account_number,
        bankName: existingWallets[0].monnify_bank_name
      };
    } else {
      // Create Monnify Reserved Account
      monnifyAccount = await createReservedAccount(user);
      // Save wallet with account info
      await sql`
        INSERT INTO wallets (
          user_id, balance, tier, monnify_account_reference, monnify_account_number, monnify_bank_name
        )
        VALUES (
          ${user.id}, 0, 'TIER_1', ${`wallet_${user.id}`}, ${monnifyAccount.accountNumber}, ${monnifyAccount.bankName}
        )
      `;
    }

    res.status(201).json({
      message: 'User registered successfully',
      token: generateToken(user),
      user,
      wallet: {
        id: user.id,
        balance: 0,
        tier: 'TIER_1',
        monnifyAccountReference: `wallet_${user.id}`,
        monnifyAccountNumber: monnifyAccount.accountNumber,
        monnifyBankName: monnifyAccount.bankName,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    const user = users[0];
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid email or password' });
    const token = generateToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    // Get user info
    const users = await sql`SELECT * FROM users WHERE id = ${req.user.id}`;
    const user = users[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get wallet info
    const wallets = await sql`SELECT monnify_account_number, tier FROM wallets WHERE user_id = ${req.user.id}`;
    const wallet = wallets[0];

    res.json({
      ...user,
      monnifyAccountNumber: wallet?.monnify_account_number || null,
      tier: wallet?.tier || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, phoneNumber } = req.body;
    let updates = [];
    let values = [];
    let idx = 1;
    if (name) { updates.push(`name = $${idx++}`); values.push(name); }
    if (email) { updates.push(`email = $${idx++}`); values.push(email); }
    if (phoneNumber) { updates.push(`phone_number = $${idx++}`); values.push(phoneNumber); }
    let imageUrl;
    if (req.file) {
      imageUrl = await uploadImage(req.file, cloudinary, fs);
      updates.push(`profile_image_url = $${idx++}`);
      values.push(imageUrl);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
    values.push(req.user.id);
    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const updated = await sql.unsafe(updateQuery, values);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    const user = users[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate 5-digit code
    const resetCode = Math.floor(10000 + Math.random() * 90000).toString();

    // Store code in Redis with 10 min expiration
    await redis.set(`reset:${email}`, resetCode, { ex: 600 });

    // Send code via email
    await transporter.sendMail({
      from: `"FINTECH" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Password Reset Code',
      html: `<p>Your password reset code is: <b>${resetCode}</b></p><p>This code expires in 10 minutes.</p>`,
    });

    res.json({ message: 'Reset code sent if the account exists.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword)
    return res.status(400).json({ error: 'Email, code, and new password required' });
  try {
    // Get code from Redis
    const storedCode = await redis.get(`reset:${email}`);
    if (!storedCode || storedCode !== code)
      return res.status(400).json({ error: 'Invalid or expired code' });

    // Update password
    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    const user = users[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password = ${hashedPassword} WHERE email = ${email}`;

    // Delete code from Redis
    await redis.del(`reset:${email}`);

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: err.message });
  }
};
