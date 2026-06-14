import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const login = async (req, res) => {
  const { email, password } = req.body;

  // 1. Input validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required.',
    });
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Invalid input format.',
    });
  }

  try {
    // 2. Query user by email only — never trust any hotel_id from the request
    const [rows] = await pool.execute(
      'SELECT id, hotel_id, name, email, role, password_hash FROM users WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = rows[0];

    // 3. Compare bcrypt hash — constant time comparison
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 4. Generate JWT — hotel_id is extracted from verified DB record, never from request
    const payload = {
      userId: user.id,
      hotelId: user.hotel_id,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '7d',
      algorithm: 'HS256',
    });

    // 5. Return token and sanitized user — never expose password_hash
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        hotel_id: user.hotel_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    // Never expose internal SQL or system errors to the client
    console.error('[AuthController] login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred. Please try again later.',
    });
  }
};
