const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: { message: 'Access token required' } });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if session exists
        const sessionResult = await query(
            'SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()',
            [token]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: { message: 'Invalid or expired session' } });
        }
        
        // Get user details
        const userResult = await query(
            'SELECT id, email, first_name, last_name, role FROM users WHERE id = $1 AND is_active = true',
            [decoded.userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: { message: 'User not found or inactive' } });
        }
        
        req.user = userResult.rows[0];
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: { message: 'Token expired' } });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: { message: 'Invalid token' } });
        }
        return res.status(500).json({ error: { message: 'Authentication error' } });
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: { message: 'Admin access required' } });
    }
};

const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userResult = await query(
                'SELECT id, email, first_name, last_name, role FROM users WHERE id = $1',
                [decoded.userId]
            );
            if (userResult.rows.length > 0) {
                req.user = userResult.rows[0];
            }
        } catch (error) {
            // Ignore token errors for optional auth
        }
    }
    next();
};

module.exports = { authenticateToken, requireAdmin, optionalAuth };