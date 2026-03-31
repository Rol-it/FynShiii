-- Users table
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'customer',
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    user_id CHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    avatar_url TEXT,
    newsletter_subscribed BOOLEAN DEFAULT FALSE,
    preferred_locale VARCHAR(10) DEFAULT 'en',
    preferred_currency VARCHAR(3) DEFAULT 'USD'
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id CHAR(36) REFERENCES categories(id),
    image_url TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    price DECIMAL(10,2) NOT NULL,
    compare_at_price DECIMAL(10,2),
    cost_per_item DECIMAL(10,2),
    brand VARCHAR(100),
    category_id CHAR(36) REFERENCES categories(id),
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_new BOOLEAN DEFAULT FALSE,
    is_on_sale BOOLEAN DEFAULT FALSE,
    weight_kg DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Product variants table
CREATE TABLE IF NOT EXISTS product_variants (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    product_id CHAR(36) REFERENCES products(id) ON DELETE CASCADE,
    size VARCHAR(20),
    color VARCHAR(50),
    color_hex VARCHAR(7),
    sku_suffix VARCHAR(50),
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    stock_quantity INT NOT NULL DEFAULT 0,
    low_stock_threshold INT DEFAULT 5,
    image_url TEXT
);

-- Product images table
CREATE TABLE IF NOT EXISTS product_images (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    product_id CHAR(36) REFERENCES products(id) ON DELETE CASCADE,
    variant_id CHAR(36) REFERENCES product_variants(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text VARCHAR(255),
    display_order INT DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE
);

-- Addresses table
CREATE TABLE IF NOT EXISTS addresses (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    user_id CHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    address_type VARCHAR(50)
);

-- Carts table
CREATE TABLE IF NOT EXISTS carts (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    user_id CHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    cart_id CHAR(36) REFERENCES carts(id) ON DELETE CASCADE,
    variant_id CHAR(36) REFERENCES product_variants(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id CHAR(36) REFERENCES users(id),
    guest_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    subtotal DECIMAL(10,2) NOT NULL,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    shipping_address_id CHAR(36) REFERENCES addresses(id),
    billing_address_id CHAR(36) REFERENCES addresses(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    order_id CHAR(36) REFERENCES orders(id) ON DELETE CASCADE,
    variant_id CHAR(36) REFERENCES product_variants(id),
    product_name VARCHAR(255) NOT NULL,
    variant_description VARCHAR(255),
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL
);

-- Wishlists table
CREATE TABLE IF NOT EXISTS wishlists (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    user_id CHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    variant_id CHAR(36) REFERENCES product_variants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, variant_id)
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    user_id CHAR(36) REFERENCES users(id),
    product_id CHAR(36) REFERENCES products(id) ON DELETE CASCADE,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    comment TEXT,
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    helpful_count INT DEFAULT 0,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (CHAR(36)()),
    user_id CHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_reviews_product ON reviews(product_id);

-- Insert sample categories
INSERT INTO categories (name, slug, description, display_order) VALUES
('Men', 'men', 'Men''s fashion collection', 1),
('Women', 'women', 'Women''s fashion collection', 2),
('Kids', 'kids', 'Kids'' fashion collection', 3),
('Accessories', 'accessories', 'Fashion accessories', 4);

-- Insert sample products
INSERT INTO products (sku, name, slug, description, short_description, price, compare_at_price, brand, category_id, is_featured, is_new) 
SELECT 
    'PRD001', 
    'Classic Cotton T-Shirt', 
    'classic-cotton-t-shirt',
    'Premium quality cotton t-shirt with a modern fit. Made from 100% organic cotton for maximum comfort and sustainability.',
    'Premium organic cotton t-shirt',
    29.99,
    49.99,
    'Premium Basics',
    (SELECT id FROM categories WHERE slug = 'men'),
    true,
    true;

INSERT INTO products (sku, name, slug, description, short_description, price, brand, category_id, is_featured) 
SELECT 
    'PRD002', 
    'Slim Fit Denim Jeans', 
    'slim-fit-denim-jeans',
    'Classic slim fit denim jeans with stretch comfort technology. Perfect for everyday wear.',
    'Classic slim fit denim jeans',
    79.99,
    'Denim Co',
    (SELECT id FROM categories WHERE slug = 'men'),
    true;

INSERT INTO products (sku, name, slug, description, short_description, price, compare_at_price, brand, category_id, is_new) 
SELECT 
    'PRD003', 
    'Wool Blend Overcoat', 
    'wool-blend-overcoat',
    'Elegant wool blend overcoat for the modern professional. Keeps you warm while maintaining style.',
    'Elegant wool blend overcoat',
    199.99,
    299.99,
    'Urban Style',
    (SELECT id FROM categories WHERE slug = 'men'),
    true;

INSERT INTO products (sku, name, slug, description, short_description, price, brand, category_id, is_featured) 
SELECT 
    'PRD004', 
    'Silk Blouse', 
    'silk-blouse',
    'Luxurious silk blouse with elegant drape. Perfect for office or evening wear.',
    'Luxurious silk blouse',
    89.99,
    'Silk & Co',
    (SELECT id FROM categories WHERE slug = 'women'),
    true;

-- Insert product variants
INSERT INTO product_variants (product_id, size, color, color_hex, stock_quantity, price_adjustment)
SELECT id, 'S', 'White', '#FFFFFF', 50, 0 FROM products WHERE sku = 'PRD001'
UNION ALL
SELECT id, 'M', 'White', '#FFFFFF', 75, 0 FROM products WHERE sku = 'PRD001'
UNION ALL
SELECT id, 'L', 'White', '#FFFFFF', 60, 0 FROM products WHERE sku = 'PRD001'
UNION ALL
SELECT id, 'XL', 'White', '#FFFFFF', 40, 0 FROM products WHERE sku = 'PRD001'
UNION ALL
SELECT id, 'M', 'Black', '#000000', 50, 0 FROM products WHERE sku = 'PRD001'
UNION ALL
SELECT id, 'L', 'Black', '#000000', 45, 0 FROM products WHERE sku = 'PRD001';