// cart.js - Модуль управления корзиной покупок для роскошного магазина VOGUE ÉLITE

class CartManager {
    constructor() {
        this.cartItems = [];
        this.cartKey = 'vogue_elite_cart';
        this.apiBase = '/api/cart';
        this.init();
    }

    // Инициализация корзины
    init() {
        this.loadFromLocalStorage();
        this.updateCartUI();
        this.setupEventListeners();
        this.setupCartNotifications();
    }

    // Загрузка корзины из LocalStorage
    loadFromLocalStorage() {
        try {
            const savedCart = localStorage.getItem(this.cartKey);
            if (savedCart) {
                this.cartItems = JSON.parse(savedCart);
                console.log('Корзина загружена из LocalStorage:', this.cartItems);
            }
        } catch (error) {
            console.error('Ошибка загрузки корзины:', error);
            this.cartItems = [];
        }
    }

    // Сохранение корзины в LocalStorage
    saveToLocalStorage() {
        try {
            localStorage.setItem(this.cartKey, JSON.stringify(this.cartItems));
        } catch (error) {
            console.error('Ошибка сохранения корзины:', error);
        }
    }

    // Синхронизация с сервером
    async syncWithServer() {
        try {
            const response = await fetch(`${this.apiBase}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify({ items: this.cartItems })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Корзина синхронизирована с сервером:', data);
                return data;
            }
        } catch (error) {
            console.error('Ошибка синхронизации корзины:', error);
        }
        return null;
    }

    // Получение CSRF токена
    getCSRFToken() {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag ? metaTag.getAttribute('content') : '';
    }

    // Добавление товара в корзину
    async addItem(productId, quantity = 1, options = {}) {
        const product = await this.fetchProductDetails(productId);
        if (!product) {
            this.showNotification('Товар не найден', 'error');
            return false;
        }

        // Проверка наличия на складе
        if (product.stock < quantity) {
            this.showNotification(`Доступно только ${product.stock} шт. на складе`, 'warning');
            quantity = Math.min(quantity, product.stock);
        }

        // Поиск существующего товара в корзине
        const existingItem = this.cartItems.find(item => 
            item.product_id === productId && 
            this.compareOptions(item.options, options)
        );

        if (existingItem) {
            // Увеличиваем количество
            existingItem.quantity += quantity;
            existingItem.quantity = Math.min(existingItem.quantity, product.stock);
            this.showNotification(`Количество товара обновлено: ${existingItem.quantity} шт.`, 'info');
        } else {
            // Добавляем новый товар
            const cartItem = {
                id: this.generateId(),
                product_id: productId,
                product: {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image_url: product.image_url,
                    category: product.category,
                    stock: product.stock,
                    discount: product.discount || 0
                },
                quantity: quantity,
                options: options,
                added_at: new Date().toISOString(),
                selected_size: options.size,
                selected_color: options.color
            };

            this.cartItems.push(cartItem);
            this.showNotification('Товар добавлен в корзину!', 'success');
        }

        this.saveToLocalStorage();
        this.updateCartUI();
        await this.syncWithServer();
        
        // Анимация добавления
        this.playAddAnimation(productId);
        
        return true;
    }

    // Обновление количества товара
    async updateQuantity(itemId, newQuantity) {
        const item = this.cartItems.find(item => item.id === itemId);
        if (!item) return false;

        const product = await this.fetchProductDetails(item.product_id);
        if (!product) return false;

        newQuantity = parseInt(newQuantity);
        if (isNaN(newQuantity) || newQuantity < 1) {
            newQuantity = 1;
        }

        if (newQuantity > product.stock) {
            this.showNotification(`Доступно только ${product.stock} шт. на складе`, 'warning');
            newQuantity = product.stock;
        }

        item.quantity = newQuantity;
        this.saveToLocalStorage();
        this.updateCartUI();
        await this.syncWithServer();

        this.showNotification(`Количество обновлено: ${newQuantity} шт.`, 'info');
        return true;
    }

    // Удаление товара из корзины
    async removeItem(itemId) {
        const itemIndex = this.cartItems.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return false;

        const item = this.cartItems[itemIndex];
        
        // Анимация удаления
        this.playRemoveAnimation(itemId);

        // Удаляем после анимации
        setTimeout(() => {
            this.cartItems.splice(itemIndex, 1);
            this.saveToLocalStorage();
            this.updateCartUI();
            this.syncWithServer();
            this.showNotification('Товар удален из корзины', 'info');
        }, 300);

        return true;
    }

    // Очистка корзины
    async clearCart() {
        if (this.cartItems.length === 0) return;

        if (!confirm('Вы уверены, что хотите очистить корзину?')) {
            return;
        }

        // Анимация очистки
        this.playClearAnimation();

        setTimeout(() => {
            this.cartItems = [];
            this.saveToLocalStorage();
            this.updateCartUI();
            this.syncWithServer();
            this.showNotification('Корзина очищена', 'info');
        }, this.cartItems.length * 100);

        return true;
    }

    // Получение информации о товаре
    async fetchProductDetails(productId) {
        try {
            // Сначала пробуем получить из кэша
            const cachedProduct = this.getCachedProduct(productId);
            if (cachedProduct) {
                return cachedProduct;
            }

            // Запрашиваем с сервера
            const response = await fetch(`${this.apiBase}/product/${productId}`);
            if (response.ok) {
                const product = await response.json();
                this.cacheProduct(product);
                return product;
            }
        } catch (error) {
            console.error('Ошибка получения информации о товаре:', error);
        }

        // Возвращаем демо данные если API недоступно
        return this.getDemoProduct(productId);
    }

    // Получение демо данных о товаре
    getDemoProduct(productId) {
        const products = {
            1: { id: 1, name: 'Вечернее платье с золотой вышивкой', price: 4500, image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8', category: 'Платья', stock: 10 },
            2: { id: 2, name: 'Шелковый шарф с принтом', price: 400, image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3', category: 'Аксессуары', stock: 25 },
            3: { id: 3, name: 'Кожаные перчатки', price: 350, image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3', category: 'Аксессуары', stock: 15 }
        };

        return products[productId] || { id: productId, name: 'Товар', price: 1000, image_url: '', category: 'Категория', stock: 5 };
    }

    // Кэширование продуктов
    cacheProduct(product) {
        const cacheKey = `product_${product.id}`;
        const cacheData = {
            data: product,
            timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    }

    // Получение продукта из кэша
    getCachedProduct(productId) {
        const cacheKey = `product_${productId}`;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
            try {
                const cacheData = JSON.parse(cached);
                // Проверяем актуальность кэша (5 минут)
                if (Date.now() - cacheData.timestamp < 5 * 60 * 1000) {
                    return cacheData.data;
                }
            } catch (error) {
                console.error('Ошибка чтения кэша:', error);
            }
        }
        
        return null;
    }

    // Сравнение опций товара
    compareOptions(options1, options2) {
        const keys1 = Object.keys(options1 || {});
        const keys2 = Object.keys(options2 || {});
        
        if (keys1.length !== keys2.length) return false;
        
        for (let key of keys1) {
            if (options1[key] !== options2[key]) {
                return false;
            }
        }
        
        return true;
    }

    // Генерация уникального ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Обновление UI корзины
    updateCartUI() {
        this.updateCartCount();
        this.updateCartTotal();
        this.updateCartDropdown();
        this.updateCartPage();
    }

    // Обновление счетчика корзины
    updateCartCount() {
        const totalItems = this.cartItems.reduce((sum, item) => sum + item.quantity, 0);
        
        // Обновляем счетчики в шапке
        const cartCountElements = document.querySelectorAll('.cart-count, #cart-count, .mobile-cart-count');
        cartCountElements.forEach(element => {
            element.textContent = totalItems;
            element.style.display = totalItems > 0 ? 'flex' : 'none';
        });

        // Обновляем иконку корзины
        const cartIcon = document.querySelector('.cart-icon');
        if (cartIcon && totalItems > 0) {
            cartIcon.classList.add('has-items');
        } else if (cartIcon) {
            cartIcon.classList.remove('has-items');
        }
    }

    // Обновление общей суммы
    updateCartTotal() {
        const total = this.cartItems.reduce((sum, item) => {
            const price = item.product.price * (1 - (item.product.discount || 0) / 100);
            return sum + (price * item.quantity);
        }, 0);

        const totalElements = document.querySelectorAll('.cart-total, #cart-total');
        totalElements.forEach(element => {
            if (element.tagName === 'INPUT') {
                element.value = total.toFixed(2);
            } else {
                element.textContent = `${total.toFixed(2)} €`;
            }
        });
    }

    // Обновление выпадающего списка корзины
    updateCartDropdown() {
        const dropdown = document.getElementById('cart-dropdown');
        if (!dropdown) return;

        if (this.cartItems.length === 0) {
            dropdown.innerHTML = `
                <div class="cart-dropdown-empty">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Ваша корзина пуста</p>
                    <a href="/catalog" class="btn-view">Перейти в каталог</a>
                </div>
            `;
            return;
        }

        let itemsHTML = '';
        let subtotal = 0;

        this.cartItems.slice(0, 3).forEach(item => {
            const price = item.product.price * (1 - (item.product.discount || 0) / 100);
            const itemTotal = price * item.quantity;
            subtotal += itemTotal;

            itemsHTML += `
                <div class="cart-dropdown-item" data-item-id="${item.id}">
                    <div class="cart-dropdown-item-image">
                        <img src="${item.product.image_url || '/static/images/placeholder.jpg'}" 
                             alt="${item.product.name}"
                             loading="lazy">
                    </div>
                    <div class="cart-dropdown-item-info">
                        <div class="cart-dropdown-item-name">${item.product.name}</div>
                        <div class="cart-dropdown-item-details">
                            ${item.selected_size ? `<span>Размер: ${item.selected_size}</span>` : ''}
                            ${item.selected_color ? `<span>Цвет: ${item.selected_color}</span>` : ''}
                        </div>
                        <div class="cart-dropdown-item-price">${item.quantity} × ${price.toFixed(2)} €</div>
                    </div>
                    <button class="cart-dropdown-item-remove" onclick="cart.removeItem('${item.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });

        const itemsCount = this.cartItems.length;
        const moreItems = itemsCount > 3 ? itemsCount - 3 : 0;

        dropdown.innerHTML = `
            <div class="cart-dropdown-header">
                <h4>Корзина (${itemsCount} ${this.getPluralForm(itemsCount, ['товар', 'товара', 'товаров'])})</h4>
            </div>
            <div class="cart-dropdown-items">
                ${itemsHTML}
            </div>
            ${moreItems > 0 ? `
                <div class="cart-dropdown-more">
                    И еще ${moreItems} ${this.getPluralForm(moreItems, ['товар', 'товара', 'товаров'])}...
                </div>
            ` : ''}
            <div class="cart-dropdown-footer">
                <div class="cart-dropdown-subtotal">
                    <span>Промежуточный итог:</span>
                    <span class="cart-dropdown-total">${subtotal.toFixed(2)} €</span>
                </div>
                <div class="cart-dropdown-actions">
                    <a href="/cart" class="btn-view">Перейти в корзину</a>
                    <a href="/checkout" class="btn-checkout">Оформить заказ</a>
                </div>
            </div>
        `;
    }

    // Обновление страницы корзины
    updateCartPage() {
        const cartPage = document.querySelector('.cart-page');
        if (!cartPage) return;

        const cartItemsContainer = document.querySelector('.cart-items-list, #cart-items');
        if (!cartItemsContainer) return;

        if (this.cartItems.length === 0) {
            cartPage.innerHTML = `
                <div class="cart-empty">
                    <div class="cart-empty-icon">
                        <i class="fas fa-shopping-cart"></i>
                    </div>
                    <h2>Ваша корзина пуста</h2>
                    <p>Похоже, вы еще ничего не добавили в корзину. Посмотрите наши эксклюзивные коллекции!</p>
                    <div class="cart-empty-actions">
                        <a href="/catalog" class="btn-primary">
                            <i class="fas fa-shopping-bag"></i>
                            <span>Перейти в каталог</span>
                        </a>
                    </div>
                </div>
            `;
            return;
        }

        let itemsHTML = '';
        let subtotal = 0;

        this.cartItems.forEach(item => {
            const price = item.product.price * (1 - (item.product.discount || 0) / 100);
            const itemTotal = price * item.quantity;
            subtotal += itemTotal;

            itemsHTML += `
                <div class="cart-item" data-item-id="${item.id}">
                    <div class="cart-item-image">
                        <img src="${item.product.image_url || '/static/images/placeholder.jpg'}" 
                             alt="${item.product.name}"
                             loading="lazy">
                    </div>
                    <div class="cart-item-info">
                        <div class="cart-item-category">${item.product.category}</div>
                        <h3 class="cart-item-name">
                            <a href="/product/${item.product_id}">${item.product.name}</a>
                        </h3>
                        <div class="cart-item-variants">
                            ${item.selected_size ? `
                                <span class="variant-badge">
                                    <span class="variant-label">Размер:</span>
                                    <span>${item.selected_size}</span>
                                </span>
                            ` : ''}
                            ${item.selected_color ? `
                                <span class="variant-badge">
                                    <span class="variant-label">Цвет:</span>
                                    <span>${item.selected_color}</span>
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="cart-item-quantity">
                        <div class="quantity-controls">
                            <button class="quantity-btn decrease" onclick="cart.changeQuantity('${item.id}', -1)">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number" 
                                   class="quantity-input" 
                                   value="${item.quantity}" 
                                   min="1" 
                                   max="${item.product.stock}"
                                   onchange="cart.updateQuantityFromInput('${item.id}', this.value)">
                            <button class="quantity-btn increase" onclick="cart.changeQuantity('${item.id}', 1)">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                    <div class="cart-item-price">
                        ${price.toFixed(2)} <span class="price-unit">€</span>
                    </div>
                    <div class="cart-item-total">
                        ${itemTotal.toFixed(2)} €
                    </div>
                    <button class="cart-item-remove" onclick="cart.removeItem('${item.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });

        cartItemsContainer.innerHTML = itemsHTML;
        
        // Обновляем итоги
        const deliveryCost = subtotal >= 20000 ? 0 : 30;
        const total = subtotal + deliveryCost;

        document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)} €`;
        document.getElementById('delivery-cost').textContent = deliveryCost === 0 ? 'Бесплатно' : `${deliveryCost.toFixed(2)} €`;
        document.getElementById('total-amount').textContent = `${total.toFixed(2)} €`;

        // Обновляем заметку о бесплатной доставке
        const deliveryNote = document.querySelector('.delivery-note');
        if (deliveryNote && subtotal < 20000) {
            const needed = 20000 - subtotal;
            deliveryNote.querySelector('strong').textContent = `${needed.toFixed(2)} €`;
            deliveryNote.style.display = 'flex';
        } else if (deliveryNote) {
            deliveryNote.style.display = 'none';
        }
    }

    // Изменение количества
    changeQuantity(itemId, delta) {
        const item = this.cartItems.find(item => item.id === itemId);
        if (!item) return;

        const newQuantity = item.quantity + delta;
        if (newQuantity < 1) {
            this.removeItem(itemId);
            return;
        }

        this.updateQuantity(itemId, newQuantity);
    }

    // Обновление количества из input
    updateQuantityFromInput(itemId, value) {
        this.updateQuantity(itemId, parseInt(value));
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Добавление в корзину
        document.addEventListener('click', (e) => {
            const addToCartBtn = e.target.closest('.btn-add-cart, .add-to-cart');
            if (addToCartBtn) {
                e.preventDefault();
                const productId = addToCartBtn.dataset.productId;
                const quantity = parseInt(addToCartBtn.dataset.quantity || 1);
                
                // Получаем опции товара
                const size = addToCartBtn.dataset.size || '';
                const color = addToCartBtn.dataset.color || '';
                
                this.addItem(productId, quantity, { size, color });
            }
        });

        // Управление корзиной
        document.addEventListener('click', (e) => {
            if (e.target.closest('#clear-cart-btn')) {
                e.preventDefault();
                this.clearCart();
            }
            
            if (e.target.closest('#update-cart-btn')) {
                e.preventDefault();
                this.syncWithServer().then(() => {
                    this.showNotification('Корзина обновлена', 'success');
                });
            }
        });

        // Перетаскивание товаров в корзину
        this.setupDragAndDrop();

        // События клавиатуры
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const focusedItem = document.querySelector('.cart-item:focus');
                if (focusedItem) {
                    const itemId = focusedItem.dataset.itemId;
                    this.removeItem(itemId);
                }
            }
        });
    }

    // Настройка перетаскивания
    setupDragAndDrop() {
        const cartIcon = document.querySelector('.cart-icon, .header-cart');
        if (!cartIcon) return;

        cartIcon.addEventListener('dragover', (e) => {
            e.preventDefault();
            cartIcon.classList.add('drag-over');
        });

        cartIcon.addEventListener('dragleave', () => {
            cartIcon.classList.remove('drag-over');
        });

        cartIcon.addEventListener('drop', (e) => {
            e.preventDefault();
            cartIcon.classList.remove('drag-over');
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                if (data.productId) {
                    this.addItem(data.productId, 1, data.options || {});
                    this.showNotification('Товар добавлен в корзину!', 'success');
                }
            } catch (error) {
                console.error('Ошибка обработки перетаскивания:', error);
            }
        });
    }

    // Настройка уведомлений о корзине
    setupCartNotifications() {
        // Показываем уведомление при добавлении в корзину
        document.addEventListener('cart:itemAdded', (e) => {
            const { product, quantity } = e.detail;
            this.showNotification(`${product.name} добавлен в корзину (${quantity} шт.)`, 'success');
        });

        // Показываем уведомление при обновлении корзины
        document.addEventListener('cart:updated', () => {
            const totalItems = this.getTotalItems();
            if (totalItems > 0) {
                const totalPrice = this.getTotalPrice();
                this.showNotification(`Корзина обновлена: ${totalItems} товаров на сумму ${totalPrice.toFixed(2)} €`, 'info');
            }
        });
    }

    // Показ уведомлений
    showNotification(message, type = 'info') {
        // Создаем или находим контейнер уведомлений
        let notificationContainer = document.getElementById('cart-notifications');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'cart-notifications';
            notificationContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 350px;
            `;
            document.body.appendChild(notificationContainer);
        }

        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `cart-notification cart-notification-${type}`;
        notification.style.cssText = `
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 15px 20px;
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s;
            animation-fill-mode: forwards;
        `;

        const icon = this.getNotificationIcon(type);
        
        notification.innerHTML = `
            <i class="${icon}" style="font-size: 1.2rem;"></i>
            <span style="flex: 1;">${message}</span>
            <button class="notification-close" style="background: none; border: none; color: white; cursor: pointer;">
                <i class="fas fa-times"></i>
            </button>
        `;

        notificationContainer.appendChild(notification);

        // Закрытие по клику
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        // Автоматическое закрытие
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    // Получение цвета уведомления
    getNotificationColor(type) {
        const colors = {
            'success': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            'error': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            'warning': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            'info': 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%)'
        };
        return colors[type] || colors.info;
    }

    // Получение иконки уведомления
    getNotificationIcon(type) {
        const icons = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    // Анимация добавления товара
    playAddAnimation(productId) {
        const button = document.querySelector(`[data-product-id="${productId}"]`);
        if (!button) return;

        // Создаем летающий элемент
        const flyElement = document.createElement('div');
        flyElement.className = 'cart-fly-animation';
        flyElement.style.cssText = `
            position: fixed;
            width: 40px;
            height: 40px;
            background: var(--gold);
            border-radius: 50%;
            pointer-events: none;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            box-shadow: var(--shadow-gold);
        `;
        flyElement.innerHTML = '<i class="fas fa-shopping-bag"></i>';

        const buttonRect = button.getBoundingClientRect();
        const cartIcon = document.querySelector('.cart-icon') || document.querySelector('.header-cart');
        const cartRect = cartIcon ? cartIcon.getBoundingClientRect() : { left: window.innerWidth - 100, top: 20 };

        // Начальная позиция
        flyElement.style.left = `${buttonRect.left + buttonRect.width / 2 - 20}px`;
        flyElement.style.top = `${buttonRect.top + buttonRect.height / 2 - 20}px`;

        document.body.appendChild(flyElement);

        // Анимация полета к корзине
        requestAnimationFrame(() => {
            flyElement.style.transition = 'all 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            flyElement.style.left = `${cartRect.left + 20}px`;
            flyElement.style.top = `${cartRect.top + 20}px`;
            flyElement.style.transform = 'scale(0.5)';
            flyElement.style.opacity = '0.5';
        });

        // Удаляем после анимации
        setTimeout(() => {
            flyElement.remove();
            
            // Анимация корзины
            if (cartIcon) {
                cartIcon.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    cartIcon.style.transform = 'scale(1)';
                }, 200);
            }
        }, 800);
    }

    // Анимация удаления товара
    playRemoveAnimation(itemId) {
        const item = document.querySelector(`[data-item-id="${itemId}"]`);
        if (!item) return;

        item.style.transition = 'all 0.3s ease';
        item.style.opacity = '0';
        item.style.transform = 'translateX(-30px)';
        item.style.height = '0';
        item.style.margin = '0';
        item.style.padding = '0';
        item.style.border = 'none';
    }

    // Анимация очистки корзины
    playClearAnimation() {
        const items = document.querySelectorAll('.cart-item');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.style.transition = 'all 0.3s ease';
                item.style.opacity = '0';
                item.style.transform = 'translateX(-50px)';
                item.style.height = '0';
                item.style.margin = '0';
                item.style.padding = '0';
                item.style.border = 'none';
            }, index * 100);
        });
    }

    // Получение формы множественного числа
    getPluralForm(number, forms) {
        number = Math.abs(number) % 100;
        const remainder = number % 10;
        
        if (number > 10 && number < 20) return forms[2];
        if (remainder > 1 && remainder < 5) return forms[1];
        if (remainder === 1) return forms[0];
        return forms[2];
    }

    // Получение общего количества товаров
    getTotalItems() {
        return this.cartItems.reduce((sum, item) => sum + item.quantity, 0);
    }

    // Получение общей суммы
    getTotalPrice() {
        return this.cartItems.reduce((sum, item) => {
            const price = item.product.price * (1 - (item.product.discount || 0) / 100);
            return sum + (price * item.quantity);
        }, 0);
    }

    // Получение содержимого корзины
    getCartItems() {
        return [...this.cartItems];
    }

    // Проверка пустоты корзины
    isEmpty() {
        return this.cartItems.length === 0;
    }

    // Экспорт корзины в JSON
    exportToJSON() {
        return JSON.stringify({
            items: this.cartItems,
            total_items: this.getTotalItems(),
            total_price: this.getTotalPrice(),
            export_date: new Date().toISOString()
        }, null, 2);
    }

    // Импорт корзины из JSON
    importFromJSON(json) {
        try {
            const data = JSON.parse(json);
            if (data.items && Array.isArray(data.items)) {
                this.cartItems = data.items;
                this.saveToLocalStorage();
                this.updateCartUI();
                this.syncWithServer();
                this.showNotification('Корзина импортирована', 'success');
                return true;
            }
        } catch (error) {
            console.error('Ошибка импорта корзины:', error);
            this.showNotification('Ошибка импорта корзины', 'error');
        }
        return false;
    }

    // Резервное копирование корзины
    backupCart() {
        const backupKey = `${this.cartKey}_backup_${Date.now()}`;
        localStorage.setItem(backupKey, JSON.stringify(this.cartItems));
        return backupKey;
    }

    // Восстановление из резервной копии
    restoreFromBackup(backupKey) {
        const backup = localStorage.getItem(backupKey);
        if (backup) {
            try {
                this.cartItems = JSON.parse(backup);
                this.saveToLocalStorage();
                this.updateCartUI();
                this.syncWithServer();
                this.showNotification('Корзина восстановлена', 'success');
                return true;
            } catch (error) {
                console.error('Ошибка восстановления корзины:', error);
            }
        }
        return false;
    }
}

// Добавляем CSS анимации для корзины
const addCartStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes fadeOut {
            from {
                opacity: 1;
            }
            to {
                opacity: 0;
            }
        }
        
        .cart-notification {
            animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s;
            animation-fill-mode: forwards;
        }
        
        .cart-icon.has-items::after {
            content: '';
            position: absolute;
            top: -5px;
            right: -5px;
            width: 8px;
            height: 8px;
            background: #ef4444;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% {
                transform: scale(1);
                opacity: 1;
            }
            50% {
                transform: scale(1.2);
                opacity: 0.7;
            }
            100% {
                transform: scale(1);
                opacity: 1;
            }
        }
        
        .cart-dropdown-empty {
            padding: 30px 20px;
            text-align: center;
            color: var(--text-secondary);
        }
        
        .cart-dropdown-empty i {
            font-size: 3rem;
            margin-bottom: 15px;
            opacity: 0.5;
        }
        
        .cart-dropdown-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border-bottom: 1px solid var(--border-color);
            transition: background-color 0.2s ease;
        }
        
        .cart-dropdown-item:hover {
            background-color: rgba(212, 175, 55, 0.05);
        }
        
        .cart-dropdown-item-image {
            width: 50px;
            height: 50px;
            border-radius: var(--radius-md);
            overflow: hidden;
            flex-shrink: 0;
        }
        
        .cart-dropdown-item-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .cart-dropdown-item-info {
            flex: 1;
            min-width: 0;
        }
        
        .cart-dropdown-item-name {
            font-weight: 600;
            color: var(--text-primary);
            font-size: 0.9rem;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .cart-dropdown-item-details {
            font-size: 0.8rem;
            color: var(--text-tertiary);
            display: flex;
            gap: 8px;
            margin-bottom: 4px;
        }
        
        .cart-dropdown-item-price {
            font-weight: 600;
            color: var(--gold);
            font-size: 0.9rem;
        }
        
        .cart-dropdown-item-remove {
            width: 24px;
            height: 24px;
            background: transparent;
            border: none;
            color: var(--text-tertiary);
            cursor: pointer;
            border-radius: var(--radius-full);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }
        
        .cart-dropdown-item-remove:hover {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
        }
        
        .cart-dropdown-footer {
            padding: 15px;
            border-top: 1px solid var(--border-color);
        }
        
        .cart-dropdown-subtotal {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            font-weight: 600;
        }
        
        .cart-dropdown-total {
            color: var(--gold);
            font-size: 1.1rem;
        }
        
        .cart-dropdown-actions {
            display: flex;
            gap: 10px;
        }
        
        .cart-dropdown-actions .btn-view,
        .cart-dropdown-actions .btn-checkout {
            flex: 1;
            padding: 10px;
            text-align: center;
            font-size: 0.9rem;
        }
        
        .cart-fly-animation {
            pointer-events: none;
            z-index: 10000;
        }
        
        .drag-over {
            animation: shake 0.5s ease;
        }
        
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(style);
};

// Инициализация корзины при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем стили
    addCartStyles();
    
    // Создаем глобальный объект корзины
    window.cart = new CartManager();
    
    console.log('Модуль корзины инициализирован');
});

// Экспорт для использования в других модулях
export default CartManager;
