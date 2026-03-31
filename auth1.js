const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// Validation rules
const registerValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').optional().isString().trim(),
    body('lastName').optional().isString().trim()
];

const loginValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
];

// Register
router.post('/register', registerValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    const { email, password, firstName, lastName } = req.body;
    
    try {
        // Check if user exists
        const existingUser = await query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: { message: 'Email already registered' } });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        // Create user
        const result = await query(
            `INSERT INTO users (email, password_hash, first_name, last_name, verification_token)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, email, first_name, last_name`,
            [email, hashedPassword, firstName || null, lastName || null, verificationToken]
        );
        
        const user = result.rows[0];
        
        // Create user profile
        await query(
            `INSERT INTO user_profiles (user_id)
             VALUES ($1)`,
            [user.id]
        );
        
        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        
        const refreshToken = jwt.sign(
            { userId: user.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
        );
        
        // Store session
        await query(
            `INSERT INTO sessions (user_id, token, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
            [user.id, refreshToken]
        );
        
        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: 'customer'
            },
            accessToken,
            refreshToken
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: { message: 'Error creating user' } });
    }
});

// Login
router.post('/login', loginValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    const { email, password } = req.body;
    
    try {
        const result = await query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: { message: 'Invalid credentials' } });
        }
        
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: { message: 'Invalid credentials' } });
        }
        
        // Update last login
        await query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );
        
        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        
        const refreshToken = jwt.sign(
            { userId: user.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
        );
        
        // Store session
        await query(
            `INSERT INTO sessions (user_id, token, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
            [user.id, refreshToken]
        );
        
        res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            },
            accessToken,
            refreshToken
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: { message: 'Error logging in' } });
    }
});

// Refresh token
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
        return res.status(401).json({ error: { message: 'Refresh token required' } });
    }
    
    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        // Check if session exists
        const sessionResult = await query(
            'SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()',
            [refreshToken]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: { message: 'Invalid refresh token' } });
        }
        
        // Get user
        const userResult = await query(
            'SELECT id, email FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: { message: 'User not found' } });
        }
        
        const user = userResult.rows[0];
        
        // Generate new access token
        const newAccessToken = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        
        res.json({ accessToken: newAccessToken });
        
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({ error: { message: 'Invalid refresh token' } });
    }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    try {
        await query(
            'DELETE FROM sessions WHERE token = $1',
            [token]
        );
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: { message: 'Error logging out' } });
    }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.role, up.phone, up.avatar_url, up.newsletter_subscribed
             FROM users u
             LEFT JOIN user_profiles up ON u.id = up.user_id
             WHERE u.id = $1`,
            [req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: { message: 'User not found' } });
        }
        
        const user = result.rows[0];
        res.json({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            phone: user.phone,
            avatarUrl: user.avatar_url,
            newsletterSubscribed: user.newsletter_subscribed
        });
        
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: { message: 'Error fetching user' } });
    }
});

module.exports = router;