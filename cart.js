const express = require('express');
const { query } = require('../database/connection');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get cart
router.get('/', optionalAuth, async (req, res) => {
    try {
        let cartId;
        
        if (req.user) {
            // Logged in user
            const cartResult = await query(
                'SELECT id FROM carts WHERE user_id = $1 AND expires_at > NOW()',
                [req.user.id]
            );
            
            if (cartResult.rows.length === 0) {
                // Create new cart
                const newCart = await query(
                    `INSERT INTO carts (user_id, expires_at)
                     VALUES ($1, NOW() + INTERVAL '30 days')
                     RETURNING id`,
                    [req.user.id]
                );
                cartId = newCart.rows[0].id;
            } else {
                cartId = cartResult.rows[0].id;
            }
        } else {
            // Guest user
            const sessionId = req.headers['x-session-id'];
            if (sessionId) {
                const cartResult = await query(
                    'SELECT id FROM carts WHERE session_id = $1 AND expires_at > NOW()',
                    [sessionId]
                );
                if (cartResult.rows.length > 0) {
                    cartId = cartResult.rows[0].id;
                }
            }
            
            if (!cartId) {
                // Create new guest cart
                const newSessionId = uuidv4();
                const newCart = await query(
                    `INSERT INTO carts (session_id, expires_at)
                     VALUES ($1, NOW() + INTERVAL '7 days')
                     RETURNING id`,
                    [newSessionId]
                );
                cartId = newCart.rows[0].id;
                res.setHeader('X-Session-ID', newSessionId);
            }
        }
        
        // Get cart items
        const itemsResult = await query(
            `SELECT ci.*, pv.size, pv.color, pv.color_hex, pv.price_adjustment,
                    p.name as product_name, p.price as base_price, p.slug,
                    (SELECT image_url FROM product_images WHERE variant_id = pv.id AND is_primary = true LIMIT 1) as image_url
             FROM cart_items ci
             JOIN product_variants pv ON ci.variant_id = pv.id
             JOIN products p ON pv.product_id = p.id
             WHERE ci.cart_id = $1`,
            [cartId]
        );
        
        // Calculate totals
        let subtotal = 0;
        const items = itemsResult.rows.map(item => {
            const itemPrice = parseFloat(item.base_price) + parseFloat(item.price_adjustment);
            const total = itemPrice * item.quantity;
            subtotal += total;
            return {
                id: item.id,
                variantId: item.variant_id,
                productName: item.product_name,
                size: item.size,
                color: item.color,
                colorHex: item.color_hex,
                quantity: item.quantity,
                unitPrice: itemPrice,
                totalPrice: total,
                imageUrl: item.image_url,
                slug: item.slug
            };
        });
        
        res.json({
            id: cartId,
            items,
            subtotal: subtotal,
            total: subtotal // Add shipping and tax later
        });
        
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ error: { message: 'Error fetching cart' } });
    }
});

// Add item to cart
router.post('/items', optionalAuth, async (req, res) => {
    try {
        const { variantId, quantity = 1 } = req.body;
        
        if (!variantId) {
            return res.status(400).json({ error: { message: 'Variant ID required' } });
        }
        
        // Check stock
        const stockResult = await query(
            'SELECT stock_quantity FROM product_variants WHERE id = $1',
            [variantId]
        );
        
        if (stockResult.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Product variant not found' } });
        }
        
        if (stockResult.rows[0].stock_quantity < quantity) {
            return res.status(400).json({ error: { message: 'Insufficient stock' } });
        }
        
        // Get or create cart
        let cartId;
        
        if (req.user) {
            const cartResult = await query(
                'SELECT id FROM carts WHERE user_id = $1 AND expires_at > NOW()',
                [req.user.id]
            );
            
            if (cartResult.rows.length === 0) {
                const newCart = await query(
                    `INSERT INTO carts (user_id, expires_at)
                     VALUES ($1, NOW() + INTERVAL '30 days')
                     RETURNING id`,
                    [req.user.id]
                );
                cartId = newCart.rows[0].id;
            } else {
                cartId = cartResult.rows[0].id;
            }
        } else {
            const sessionId = req.headers['x-session-id'];
            let cartResult;
            
            if (sessionId) {
                cartResult = await query(
                    'SELECT id FROM carts WHERE session_id = $1 AND expires_at > NOW()',
                    [sessionId]
                );
            }
            
            if (!cartResult || cartResult.rows.length === 0) {
                const newSessionId = sessionId || uuidv4();
                const newCart = await query(
                    `INSERT INTO carts (session_id, expires_at)
                     VALUES ($1, NOW() + INTERVAL '7 days')
                     RETURNING id`,
                    [newSessionId]
                );
                cartId = newCart.rows[0].id;
                if (!sessionId) {
                    res.setHeader('X-Session-ID', newSessionId);
                }
            } else {
                cartId = cartResult.rows[0].id;
            }
        }
        
        // Check if item already in cart
        const existingItem = await query(
            'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND variant_id = $2',
            [cartId, variantId]
        );
        
        if (existingItem.rows.length > 0) {
            const newQuantity = existingItem.rows[0].quantity + quantity;
            if (newQuantity > stockResult.rows[0].stock_quantity) {
                return res.status(400).json({ error: { message: 'Insufficient stock' } });
            }
            
            await query(
                'UPDATE cart_items SET quantity = $1 WHERE id = $2',
                [newQuantity, existingItem.rows[0].id]
            );
        } else {
            await query(
                `INSERT INTO cart_items (cart_id, variant_id, quantity)
                 VALUES ($1, $2, $3)`,
                [cartId, variantId, quantity]
            );
        }
        
        res.json({ message: 'Item added to cart successfully' });
        
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ error: { message: 'Error adding item to cart' } });
    }
});

// Update cart item quantity
router.put('/items/:itemId', optionalAuth, async (req, res) => {
    try {
        const { itemId } = req.params;
        const { quantity } = req.body;
        
        if (!quantity || quantity < 1) {
            return res.status(400).json({ error: { message: 'Valid quantity required' } });
        }
        
        // Get cart item details
        const itemResult = await query(
            `SELECT ci.*, pv.stock_quantity
             FROM cart_items ci
             JOIN product_variants pv ON ci.variant_id = pv.id
             WHERE ci.id = $1`,
            [itemId]
        );
        
        if (itemResult.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Cart item not found' } });
        }
        
        const item = itemResult.rows[0];
        
        if (quantity > item.stock_quantity) {
            return res.status(400).json({ error: { message: 'Insufficient stock' } });
        }
        
        await query(
            'UPDATE cart_items SET quantity = $1 WHERE id = $2',
            [quantity, itemId]
        );
        
        res.json({ message: 'Cart updated successfully' });
        
    } catch (error) {
        console.error('Update cart error:', error);
        res.status(500).json({ error: { message: 'Error updating cart' } });
    }
});

// Remove item from cart
router.delete('/items/:itemId', optionalAuth, async (req, res) => {
    try {
        const { itemId } = req.params;
        
        await query(
            'DELETE FROM cart_items WHERE id = $1',
            [itemId]
        );
        
        res.json({ message: 'Item removed from cart' });
        
    } catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({ error: { message: 'Error removing item' } });
    }
});

// Clear cart
router.delete('/clear', optionalAuth, async (req, res) => {
    try {
        let cartId;
        
        if (req.user) {
            const cartResult = await query(
                'SELECT id FROM carts WHERE user_id = $1 AND expires_at > NOW()',
                [req.user.id]
            );
            if (cartResult.rows.length > 0) {
                cartId = cartResult.rows[0].id;
            }
        } else {
            const sessionId = req.headers['x-session-id'];
            if (sessionId) {
                const cartResult = await query(
                    'SELECT id FROM carts WHERE session_id = $1 AND expires_at > NOW()',
                    [sessionId]
                );
                if (cartResult.rows.length > 0) {
                    cartId = cartResult.rows[0].id;
                }
            }
        }
        
        if (cartId) {
            await query(
                'DELETE FROM cart_items WHERE cart_id = $1',
                [cartId]
            );
        }
        
        res.json({ message: 'Cart cleared successfully' });
        
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ error: { message: 'Error clearing cart' } });
    }
});

module.exports = router;