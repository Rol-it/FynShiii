// Global state
window.AppState = {
    user: null,
    cart: null,
    wishlist: [],
    isAuthenticated: false
};

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadInitialData();
});

function initializeApp() {
    // Check if user is logged in
    const token = localStorage.getItem('accessToken');
    if (token) {
        verifyAndLoadUser();
    }
    
    // Load cart
    loadCart();
}

async function verifyAndLoadUser() {
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
            }
        });
        
        if (response.ok) {
            const user = await response.json();
            window.AppState.user = user;
            window.AppState.isAuthenticated = true;
            updateUserInterface();
        } else {
            // Token invalid
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

async function loadCart() {
    try {
        const cart = await CartAPI.getCart();
        window.AppState.cart = cart;
        updateCartUI();
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

function setupEventListeners() {
    // Cart toggle
    const cartToggle = document.querySelector('.cart-toggle');
    if (cartToggle) {
        cartToggle.addEventListener('click', toggleCartDrawer);
    }
    
    // Close cart drawer
    const closeDrawer = document.querySelector('.close-drawer');
    if (closeDrawer) {
        closeDrawer.addEventListener('click', closeCartDrawer);
    }
    
    // Continue shopping
    const continueShopping = document.querySelector('.continue-shopping');
    if (continueShopping) {
        continueShopping.addEventListener('click', closeCartDrawer);
    }
    
    // Search toggle
    const searchToggle = document.querySelector('.search-toggle');
    const searchBar = document.querySelector('.search-bar');
    const closeSearch = document.querySelector('.close-search');
    
    if (searchToggle) {
        searchToggle.addEventListener('click', () => {
            searchBar.classList.toggle('active');
            if (searchBar.classList.contains('active')) {
                document.getElementById('search-input')?.focus();
            }
        });
    }
    
    if (closeSearch) {
        closeSearch.addEventListener('click', () => {
            searchBar.classList.remove('active');
        });
    }
    
    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                handleSearch(e.target.value);
            }, 300);
        });
    }
    
    // Auth modal
    const userToggle = document.querySelector('.user-toggle');
    const authModal = document.getElementById('auth-modal');
    const closeModal = document.querySelector('.close-modal');
    
    if (userToggle) {
        userToggle.addEventListener('click', () => {
            if (window.AppState.isAuthenticated) {
                // Show user menu or redirect to account
                window.location.href = '/pages/account/dashboard.html';
            } else {
                authModal.classList.add('open');
            }
        });
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            authModal.classList.remove('open');
        });
    }
    
    // Auth form switching
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.remove('active');
            registerForm.classList.add('active');
            document.getElementById('auth-modal-title').textContent = 'Create Account';
        });
    }
    
    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.classList.remove('active');
            loginForm.classList.add('active');
            document.getElementById('auth-modal-title').textContent = 'Sign In';
        });
    }
    
    // Login form submit
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Register form submit
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Newsletter form
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', handleNewsletter);
    }
    
    // Close modals on outside click
    window.addEventListener('click', (e) => {
        if (e.target === authModal) {
            authModal.classList.remove('open');
        }
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.querySelector('input[type="email"]').value;
    const password = form.querySelector('input[type="password"]').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            
            window.AppState.user = data.user;
            window.AppState.isAuthenticated = true;
            updateUserInterface();
            
            // Close modal
            document.getElementById('auth-modal').classList.remove('open');
            
            // Reload cart (merge guest cart)
            await loadCart();
            
            showToast('Welcome back!', 'success');
        } else {
            const error = await response.json();
            showToast(error.error?.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const firstName = form.querySelector('input[placeholder="First Name"]').value;
    const lastName = form.querySelector('input[placeholder="Last Name"]').value;
    const email = form.querySelector('input[type="email"]').value;
    const password = form.querySelectorAll('input[type="password"]')[0].value;
    const confirmPassword = form.querySelectorAll('input[type="password"]')[1].value;
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ firstName, lastName, email, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            
            window.AppState.user = data.user;
            window.AppState.isAuthenticated = true;
            updateUserInterface();
            
            // Close modal
            document.getElementById('auth-modal').classList.remove('open');
            
            // Reload cart
            await loadCart();
            
            showToast('Account created successfully!', 'success');
        } else {
            const error = await response.json();
            showToast(error.error?.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Registration failed. Please try again.', 'error');
    }
}

function updateUserInterface() {
    const userToggle = document.querySelector('.user-toggle');
    if (userToggle && window.AppState.isAuthenticated) {
        userToggle.innerHTML = '<i class="fas fa-user-check"></i>';
        userToggle.title = window.AppState.user?.firstName || 'Account';
    }
}

function updateCartUI() {
    const cartCount = document.querySelector('.cart-count');
    const cartSubtotal = document.getElementById('cart-subtotal');
    const cartItemsContainer = document.getElementById('cart-items-container');
    
    if (window.AppState.cart && window.AppState.cart.items) {
        const itemCount = window.AppState.cart.items.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCount) cartCount.textContent = itemCount;
        if (cartSubtotal) cartSubtotal.textContent = `$${window.AppState.cart.subtotal.toFixed(2)}`;
        
        if (cartItemsContainer) {
            if (window.AppState.cart.items.length === 0) {
                cartItemsContainer.innerHTML = `
                    <div class="empty-cart">
                        <i class="fas fa-shopping-bag"></i>
                        <p>Your cart is empty</p>
                        <button class="btn-primary continue-shopping">Continue Shopping</button>
                    </div>
                `;
                
                // Reattach event listener
                const continueBtn = cartItemsContainer.querySelector('.continue-shopping');
                if (continueBtn) {
                    continueBtn.addEventListener('click', closeCartDrawer);
                }
            } else {
                cartItemsContainer.innerHTML = window.AppState.cart.items.map(item => `
                    <div class="cart-item" data-item-id="${item.id}">
                        <div class="cart-item-image">
                            <img src="${item.imageUrl || 'https://placehold.co/80x80/f5f5f5/737373?text=Product'}" alt="${item.productName}">
                        </div>
                        <div class="cart-item-details">
                            <div class="cart-item-name">${escapeHtml(item.productName)}</div>
                            <div class="cart-item-variant">${item.size ? `Size: ${item.size}` : ''} ${item.color ? `Color: ${item.color}` : ''}</div>
                            <div class="cart-item-price">$${item.unitPrice.toFixed(2)}</div>
                            <div class="cart-item-quantity">
                                <button class="quantity-btn decrease">-</button>
                                <span>${item.quantity}</span>
                                <button class="quantity-btn increase">+</button>
                                <button class="remove-item"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                `).join('');
                
                // Attach event listeners to cart items
                attachCartItemEvents();
            }
        }
    }
}

function attachCartItemEvents() {
    document.querySelectorAll('.cart-item').forEach(item => {
        const itemId = item.dataset.itemId;
        const decreaseBtn = item.querySelector('.decrease');
        const increaseBtn = item.querySelector('.increase');
        const removeBtn = item.querySelector('.remove-item');
        const quantitySpan = item.querySelector('.cart-item-quantity span');
        
        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', async () => {
                const currentQty = parseInt(quantitySpan.textContent);
                if (currentQty > 1) {
                    await CartAPI.updateItem(itemId, currentQty - 1);
                    await loadCart();
                }
            });
        }
        
        if (increaseBtn) {
            increaseBtn.addEventListener('click', async () => {
                const currentQty = parseInt(quantitySpan.textContent);
                await CartAPI.updateItem(itemId, currentQty + 1);
                await loadCart();
            });
        }
        
        if (removeBtn) {
            removeBtn.addEventListener('click', async () => {
                await CartAPI.removeItem(itemId);
                await loadCart();
            });
        }
    });
}

function toggleCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    if (drawer) {
        drawer.classList.add('open');
    }
}

function closeCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    if (drawer) {
        drawer.classList.remove('open');
    }
}

async function handleSearch(query) {
    if (query.length < 2) return;
    
    try {
        const response = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=5`);
        const data = await response.json();
        
        const suggestionsContainer = document.querySelector('.search-suggestions');
        if (suggestionsContainer && data.products) {
            if (data.products.length > 0) {
                suggestionsContainer.innerHTML = data.products.map(product => `
                    <a href="/pages/product.html?slug=${product.slug}" class="suggestion-item">
                        <img src="${product.primary_image || 'https://placehold.co/40x40/f5f5f5/737373'}" alt="${product.name}">
                        <div>
                            <div>${escapeHtml(product.name)}</div>
                            <div>$${parseFloat(product.price).toFixed(2)}</div>
                        </div>
                    </a>
                `).join('');
                suggestionsContainer.classList.add('active');
            } else {
                suggestionsContainer.classList.remove('active');
            }
        }
    } catch (error) {
        console.error('Search error:', error);
    }
}

async function handleNewsletter(e) {
    e.preventDefault();
    const email = e.target.querySelector('input').value;
    
    try {
        const response = await fetch('/api/newsletter/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        if (response.ok) {
            showToast('Subscribed successfully!', 'success');
            e.target.reset();
        }
    } catch (error) {
        console.error('Newsletter error:', error);
        showToast('Subscription failed', 'error');
    }
}

function showToast(message, type) {
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

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function loadInitialData() {
    // Load best sellers
    const bestSellersGrid = document.getElementById('best-sellers-grid');
    if (bestSellersGrid) {
        try {
            const response = await fetch('/api/products?featured=true&limit=4');
            const data = await response.json();
            
            bestSellersGrid.innerHTML = '';
            data.products.forEach(product => {
                new ProductCard(product, bestSellersGrid).render();
            });
        } catch (error) {
            console.error('Error loading best sellers:', error);
        }
    }
    
    // Load new collection
    const newCollectionGrid = document.getElementById('new-collection-grid');
    if (newCollectionGrid) {
        try {
            const response = await fetch('/api/products?new=true&limit=4');
            const data = await response.json();
            
            newCollectionGrid.innerHTML = '';
            data.products.forEach(product => {
                new ProductCard(product, newCollectionGrid).render();
            });
        } catch (error) {
            console.error('Error loading new collection:', error);
        }
    }
}
// Dark Mode Functionality - Complete Working Version
class DarkModeManager {
    constructor() {
        this.themeToggle = null;
        this.currentTheme = 'light';
        this.init();
    }
    
    init() {
        // Get theme toggle button
        this.themeToggle = document.getElementById('theme-toggle');
        
        // Load saved theme or system preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.currentTheme = savedTheme;
        } else {
            // Check system preference
            this.currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        
        // Apply theme
        this.applyTheme(this.currentTheme);
        
        // Add event listener to toggle button
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
        
        // Add transition class to body for smooth changes
        document.body.classList.add('theme-transition-ready');
        
        console.log('Dark mode initialized with theme:', this.currentTheme);
    }
    
    applyTheme(theme) {
        const html = document.documentElement;
        
        if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
            this.updateIcon('dark');
            localStorage.setItem('theme', 'dark');
            this.currentTheme = 'dark';
        } else {
            html.removeAttribute('data-theme');
            this.updateIcon('light');
            localStorage.setItem('theme', 'light');
            this.currentTheme = 'light';
        }
        
        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme: this.currentTheme } 
        }));
        
        // Log for debugging
        console.log('Theme applied:', this.currentTheme);
        console.log('HTML data-theme:', html.getAttribute('data-theme'));
        console.log('Body bg color:', getComputedStyle(document.body).backgroundColor);
    }
    
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        
        // Add animation to button
        if (this.themeToggle) {
            this.themeToggle.style.animation = 'spin 0.5s ease';
            setTimeout(() => {
                if (this.themeToggle) {
                    this.themeToggle.style.animation = '';
                }
            }, 500);
        }
    }
    
    updateIcon(theme) {
        if (!this.themeToggle) return;
        
        const icon = this.themeToggle.querySelector('i');
        if (icon) {
            if (theme === 'dark') {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            } else {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
        }
    }
}

// Initialize dark mode when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.darkMode = new DarkModeManager();
});

// Add debug function to check if dark mode is working
window.checkDarkMode = function() {
    const theme = document.documentElement.getAttribute('data-theme');
    const bgColor = getComputedStyle(document.body).backgroundColor;
    console.log('Current theme:', theme || 'light');
    console.log('Body background color:', bgColor);
    console.log('Text color:', getComputedStyle(document.body).color);
    return {
        theme: theme || 'light',
        backgroundColor: bgColor,
        textColor: getComputedStyle(document.body).color
    };
};

// Expose functions globally
window.toggleCartDrawer = toggleCartDrawer;
window.closeCartDrawer = closeCartDrawer;
window.updateCartCount = loadCart;
window.showToast = showToast;