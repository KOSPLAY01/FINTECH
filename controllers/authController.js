import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import sql from '../config/db.js';
import transporter from '../config/mailer.js';
import cloudinary from '../config/cloudinary.js';
import uploadImage from '../utils/uploadImage.js';
import fs from 'fs';

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
  if (!email || !password || !name) return res.status(400).json({ error: 'All fields are required' });

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
    res.status(201).json({
      message: 'User registered successfully',
      token: generateToken(user),
      user,
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
    const users = await sql`SELECT * FROM users WHERE id = ${req.user.id}`;
    const user = users[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
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
    const resetToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const resetUrl = `https://localhost:3000/reset-password?token=${resetToken}`;
    await transporter.sendMail({
      from: `"GIFTY CAKES" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `<p>Click below to reset your password:</p><a href="${resetUrl}">${resetUrl}</a><p>Link expires in 15 minutes.</p>`,
    });
    res.json({ message: 'Reset email sent if the account exists.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
    const user = users[0];
    if (!user) return res.status(400).json({ error: 'Invalid token or user not found' });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${userId}`;
    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(400).json({ error: 'Invalid or expired token' });
  }
};
