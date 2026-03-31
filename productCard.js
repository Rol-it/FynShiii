class ProductCard {
    constructor(product, container, options = {}) {
        this.product = product;
        this.container = container;
        this.options = options;
        this.element = null;
    }
    
    render() {
        const card = document.createElement('a');
        card.href = `/pages/product.html?slug=${this.product.slug}`;
        card.className = 'product-card';
        
        const primaryImage = this.product.primary_image || 'https://placehold.co/400x500/f5f5f5/737373?text=Product';
        
        card.innerHTML = `
            <div class="product-image">
                ${this.renderBadge()}
                <img src="${primaryImage}" alt="${this.product.name}" loading="lazy">
                <div class="product-actions">
                    <button class="product-action-btn add-to-wishlist" data-product-id="${this.product.id}">
                        <i class="far fa-heart"></i>
                    </button>
                    <button class="product-action-btn quick-add" data-product-id="${this.product.id}">
                        <i class="fas fa-shopping-bag"></i>
                    </button>
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${this.escapeHtml(this.product.name)}</h3>
                <div class="product-price">
                    ${this.renderPrice()}
                </div>
                ${this.renderColors()}
            </div>
        `;
        
        this.element = card;
        
        // Add event listeners
        const wishlistBtn = card.querySelector('.add-to-wishlist');
        if (wishlistBtn) {
            wishlistBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleWishlist();
            });
        }
        
        const quickAddBtn = card.querySelector('.quick-add');
        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleQuickAdd();
            });
        }
        
        this.container.appendChild(card);
        return card;
    }
    
    renderBadge() {
        if (this.product.is_on_sale) {
            return '<span class="product-badge sale">Sale</span>';
        }
        if (this.product.is_new) {
            return '<span class="product-badge">New</span>';
        }
        return '';
    }
    
    renderPrice() {
        let html = `<span class="current-price">$${parseFloat(this.product.price).toFixed(2)}</span>`;
        
        if (this.product.compare_at_price && this.product.compare_at_price > this.product.price) {
            html += `<span class="original-price">$${parseFloat(this.product.compare_at_price).toFixed(2)}</span>`;
        }
        
        return html;
    }
    
    renderColors() {
        // This would need actual color data from the API
        // For now, return empty string
        return '';
    }
    
    async handleWishlist() {
        try {
            const response = await fetch('/api/wishlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                },
                body: JSON.stringify({
                    productId: this.product.id
                })
            });
            
            if (response.ok) {
                this.showToast('Added to wishlist', 'success');
                const heartIcon = this.element.querySelector('.add-to-wishlist i');
                if (heartIcon) {
                    heartIcon.classList.remove('far');
                    heartIcon.classList.add('fas');
                }
            }
        } catch (error) {
            console.error('Error adding to wishlist:', error);
            this.showToast('Please login to add to wishlist', 'error');
        }
    }
    
    async handleQuickAdd() {
        // Get first variant
        try {
            const response = await fetch(`/api/products/${this.product.slug}`);
            const productData = await response.json();
            
            if (productData.variants && productData.variants.length > 0) {
                const variant = productData.variants[0];
                
                const cartResponse = await fetch('/api/cart/items', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                    },
                    body: JSON.stringify({
                        variantId: variant.id,
                        quantity: 1
                    })
                });
                
                if (cartResponse.ok) {
                    this.showToast('Added to cart', 'success');
                    // Update cart count
                    if (window.updateCartCount) {
                        window.updateCartCount();
                    }
                }
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            this.showToast('Error adding to cart', 'error');
        }
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    showToast(message, type) {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 24px;
            background: ${type === 'success' ? '#2c5f2d' : '#dc2626'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Export for use
window.ProductCard = ProductCard;