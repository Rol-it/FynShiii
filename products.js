const express = require('express');
const { query } = require('../database/connection');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get all products with filters
router.get('/', optionalAuth, async (req, res) => {
    try {
        const {
            category,
            minPrice,
            maxPrice,
            size,
            color,
            sort = 'created_at',
            order = 'DESC',
            limit = 20,
            offset = 0,
            featured,
            new: isNew,
            search
        } = req.query;
        
        let sql = `
            SELECT DISTINCT p.*, c.name as category_name,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as primary_image
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_variants pv ON p.id = pv.product_id
            WHERE p.is_active = true
        `;
        
        const params = [];
        let paramIndex = 1;
        
        if (category) {
            sql += ` AND c.slug = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }
        
        if (minPrice) {
            sql += ` AND p.price >= $${paramIndex}`;
            params.push(minPrice);
            paramIndex++;
        }
        
        if (maxPrice) {
            sql += ` AND p.price <= $${paramIndex}`;
            params.push(maxPrice);
            paramIndex++;
        }
        
        if (size) {
            sql += ` AND pv.size = $${paramIndex}`;
            params.push(size);
            paramIndex++;
        }
        
        if (color) {
            sql += ` AND pv.color = $${paramIndex}`;
            params.push(color);
            paramIndex++;
        }
        
        if (featured === 'true') {
            sql += ` AND p.is_featured = true`;
        }
        
        if (isNew === 'true') {
            sql += ` AND p.is_new = true`;
        }
        
        if (search) {
            sql += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        
        // Sorting
        const allowedSortFields = ['price', 'name', 'created_at', 'updated_at'];
        const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
        const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        sql += ` GROUP BY p.id, c.name ORDER BY ${sortField} ${sortOrder}`;
        
        // Pagination
        sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        
        const result = await query(sql, params);
        
        // Get total count
        let countSql = 'SELECT COUNT(DISTINCT p.id) as total FROM products p WHERE p.is_active = true';
        if (category) {
            countSql += ` AND p.category_id IN (SELECT id FROM categories WHERE slug = $1)`;
        }
        const countResult = await query(countSql, category ? [category] : []);
        
        res.json({
            products: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0]?.total || 0),
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
        
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: { message: 'Error fetching products' } });
    }
});

// Get single product by slug
router.get('/:slug', optionalAuth, async (req, res) => {
    try {
        const { slug } = req.params;
        
        const productResult = await query(
            `SELECT p.*, c.name as category_name, c.slug as category_slug
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.slug = $1 AND p.is_active = true`,
            [slug]
        );
        
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Product not found' } });
        }
        
        const product = productResult.rows[0];
        
        // Get variants
        const variantsResult = await query(
            `SELECT * FROM product_variants
             WHERE product_id = $1`,
            [product.id]
        );
        
        // Get images
        const imagesResult = await query(
            `SELECT * FROM product_images
             WHERE product_id = $1
             ORDER BY display_order ASC`,
            [product.id]
        );
        
        // Get reviews
        const reviewsResult = await query(
            `SELECT r.*, u.first_name, u.last_name
             FROM reviews r
             LEFT JOIN users u ON r.user_id = u.id
             WHERE r.product_id = $1 AND r.is_approved = true
             ORDER BY r.created_at DESC
             LIMIT 10`,
            [product.id]
        );
        
        // Get average rating
        const ratingResult = await query(
            `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
             FROM reviews
             WHERE product_id = $1 AND is_approved = true`,
            [product.id]
        );
        
        res.json({
            ...product,
            variants: variantsResult.rows,
            images: imagesResult.rows,
            reviews: reviewsResult.rows,
            averageRating: parseFloat(ratingResult.rows[0]?.avg_rating || 0),
            reviewCount: parseInt(ratingResult.rows[0]?.review_count || 0)
        });
        
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: { message: 'Error fetching product' } });
    }
});

// Get product filters (available options)
router.get('/filters/options', async (req, res) => {
    try {
        const sizesResult = await query(
            'SELECT DISTINCT size FROM product_variants WHERE size IS NOT NULL ORDER BY size'
        );
        
        const colorsResult = await query(
            'SELECT DISTINCT color, color_hex FROM product_variants WHERE color IS NOT NULL ORDER BY color'
        );
        
        const categoriesResult = await query(
            'SELECT id, name, slug FROM categories WHERE is_active = true ORDER BY display_order'
        );
        
        const priceRangeResult = await query(
            'SELECT MIN(price) as min_price, MAX(price) as max_price FROM products WHERE is_active = true'
        );
        
        res.json({
            sizes: sizesResult.rows.map(r => r.size),
            colors: colorsResult.rows,
            categories: categoriesResult.rows,
            priceRange: {
                min: parseFloat(priceRangeResult.rows[0]?.min_price || 0),
                max: parseFloat(priceRangeResult.rows[0]?.max_price || 0)
            }
        });
        
    } catch (error) {
        console.error('Get filters error:', error);
        res.status(500).json({ error: { message: 'Error fetching filters' } });
    }
});

module.exports = router;