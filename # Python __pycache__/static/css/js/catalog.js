// catalog.js - Продвинутый модуль каталога товаров для VOGUE ÉLITE

class CatalogManager {
    constructor() {
        this.products = [];
        this.filteredProducts = [];
        this.filters = {
            category: 'all',
            price: { min: 0, max: 100000 },
            brands: [],
            colors: [],
            sizes: [],
            specials: [],
            sort: 'newest',
            view: 'grid',
            gridSize: 2
        };
        this.currentPage = 1;
        this.productsPerPage = 12;
        this.totalPages = 1;
        this.isLoading = false;
        this.isMobile = window.innerWidth < 768;
        
        this.init();
    }

    // Инициализация каталога
    async init() {
        this.setupEventListeners();
        this.setupUI();
        this.setupIntersectionObserver();
        this.setupDragAndDrop();
        
        // Загружаем продукты
        await this.loadProducts();
        
        // Применяем начальные фильтры
        this.applyFilters();
        
        // Восстанавливаем состояние из LocalStorage
        this.restoreState();
        
        console.log('Каталог инициализирован');
    }

    // Загрузка продуктов
    async loadProducts() {
        this.showLoading();
        
        try {
            // Пробуем загрузить с сервера
            const response = await fetch('/api/products');
            if (response.ok) {
                this.products = await response.json();
                this.cacheProducts();
            } else {
                // Используем демо данные если API недоступно
                this.products = this.getDemoProducts();
            }
        } catch (error) {
            console.error('Ошибка загрузки продуктов:', error);
            this.products = this.getDemoProducts();
        }
        
        this.hideLoading();
    }

    // Получение демо продуктов
    getDemoProducts() {
        return Array.from({ length: 48 }, (_, i) => ({
            id: i + 1,
            name: this.getProductName(i),
            category: this.getCategory(i),
            price: this.getPrice(i),
            discount: i % 5 === 0 ? 20 : i % 7 === 0 ? 15 : 0,
            image_url: `https://images.unsplash.com/photo-${1595777457583 + i}?w=800&h=1200&fit=crop&q=80`,
            brand: this.getBrand(i),
            color: this.getColor(i),
            size: this.getSize(i),
            is_new: i < 12,
            is_exclusive: i % 10 === 0,
            is_limited: i % 15 === 0,
            stock: Math.floor(Math.random() * 50) + 5,
            rating: 4 + Math.random(),
            description: 'Эксклюзивный товар премиум-класса из коллекции VOGUE ÉLITE',
            created_at: new Date(Date.now() - i * 86400000).toISOString()
        }));
    }

    // Генератор названий товаров
    getProductName(index) {
        const types = [
            'Вечернее платье с золотой вышивкой',
            'Костюм премиум-класса',
            'Шелковая блуза',
            'Кожаная куртка',
            'Юбка-карандаш',
            'Брюки-клеш',
            'Пальто из кашемира',
            'Сумочка из крокодиловой кожи',
            'Туфли на каблуке',
            'Колье с бриллиантами'
        ];
        const adjectives = ['Роскошное', 'Эксклюзивное', 'Лимитированное', 'VIP', 'Дизайнерское'];
        return `${adjectives[index % adjectives.length]} ${types[index % types.length]}`;
    }

    // Генератор категорий
    getCategory(index) {
        const categories = [
            'Платья', 'Костюмы', 'Блузы', 'Брюки', 'Юбки',
            'Куртки', 'Пальто', 'Обувь', 'Сумки', 'Украшения'
        ];
        return categories[index % categories.length];
    }

    // Генератор цен
    getPrice(index) {
        const basePrices = [4500, 3200, 2800, 1900, 3500, 4200, 3800, 2900, 2100, 5500];
        return basePrices[index % basePrices.length];
    }

    // Генератор брендов
    getBrand(index) {
        const brands = ['vogue', 'dior', 'chanel', 'gucci', 'prada'];
        return brands[index % brands.length];
    }

    // Генератор цветов
    getColor(index) {
        const colors = ['черный', 'белый', 'красный', 'синий', 'зеленый', 'золотой', 'серебряный'];
        return colors[index % colors.length];
    }

    // Генератор размеров
    getSize(index) {
        const sizes = ['XS', 'S', 'M', 'L', 'XL'];
        return sizes[index % sizes.length];
    }

    // Кэширование продуктов
    cacheProducts() {
        try {
            const cacheData = {
                products: this.products,
                timestamp: Date.now()
            };
            localStorage.setItem('catalog_cache', JSON.stringify(cacheData));
        } catch (error) {
            console.error('Ошибка кэширования:', error);
        }
    }

    // Загрузка из кэша
    loadFromCache() {
        try {
            const cached = localStorage.getItem('catalog_cache');
            if (cached) {
                const cacheData = JSON.parse(cached);
                // Проверяем актуальность (1 час)
                if (Date.now() - cacheData.timestamp < 3600000) {
                    return cacheData.products;
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки из кэша:', error);
        }
        return null;
    }

    // Настройка UI
    setupUI() {
        this.createQuickViewModal();
        this.createCompareModal();
        this.createFiltersModal();
        this.setupTooltips();
        this.setupProductCards();
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Фильтры категорий
        document.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const category = item.dataset.category || 'all';
                this.setFilter('category', category);
                this.updateCategoryUI(category);
            });
        });

        // Фильтр цены
        const priceSlider = document.getElementById('range-min');
        const priceSliderMax = document.getElementById('range-max');
        if (priceSlider && priceSliderMax) {
            priceSlider.addEventListener('input', () => this.updatePriceFilter());
            priceSliderMax.addEventListener('input', () => this.updatePriceFilter());
        }

        // Фильтры брендов
        document.querySelectorAll('.filter-item[data-filter="brand"]').forEach(item => {
            item.addEventListener('click', () => {
                const brand = item.dataset.value;
                this.toggleFilter('brands', brand);
                this.updateFilterUI(item, 'brands', brand);
            });
        });

        // Фильтры цветов
        document.querySelectorAll('.color-item').forEach(item => {
            item.addEventListener('click', () => {
                const color = this.getColorFromElement(item);
                this.setFilter('colors', [color]);
                this.updateColorUI(item);
            });
        });

        // Фильтры размеров
        document.querySelectorAll('.size-item').forEach(item => {
            item.addEventListener('click', () => {
                const size = item.textContent.trim();
                this.setFilter('sizes', [size]);
                this.updateSizeUI(item);
            });
        });

        // Специальные фильтры
        document.querySelectorAll('.filter-item[data-filter="special"]').forEach(item => {
            item.addEventListener('click', () => {
                const special = item.dataset.value;
                this.toggleFilter('specials', special);
                this.updateFilterUI(item, 'specials', special);
            });
        });

        // Сортировка
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.setFilter('sort', e.target.value);
                this.applyFilters();
            });
        }

        // Вид отображения
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = btn.dataset.view;
                this.setFilter('view', view);
                this.updateViewUI(view);
            });
        });

        // Размер сетки
        const gridSlider = document.getElementById('grid-size');
        if (gridSlider) {
            gridSlider.addEventListener('input', (e) => {
                this.setFilter('gridSize', parseInt(e.target.value));
                this.updateGridSize(parseInt(e.target.value));
            });
        }

        // Сброс фильтров
        const clearFiltersBtn = document.querySelector('.clear-filters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.resetFilters());
        }

        // Поиск
        const searchInput = document.getElementById('catalog-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.searchProducts(e.target.value));
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchProducts(e.target.value);
            });
        }

        // Пагинация
        document.addEventListener('click', (e) => {
            if (e.target.closest('.page-btn') && !e.target.closest('.page-btn.disabled')) {
                e.preventDefault();
                const page = parseInt(e.target.closest('.page-btn').textContent);
                if (page) this.goToPage(page);
            }
            
            if (e.target.closest('#prev-page')) {
                e.preventDefault();
                this.goToPage(this.currentPage - 1);
            }
            
            if (e.target.closest('#next-page')) {
                e.preventDefault();
                this.goToPage(this.currentPage + 1);
            }
        });

        // Быстрый просмотр
        document.addEventListener('click', (e) => {
            const quickViewBtn = e.target.closest('.quick-view-btn, .action-btn .fa-eye');
            if (quickViewBtn) {
                e.preventDefault();
                const productId = quickViewBtn.closest('.product-card').dataset.productId;
                this.showQuickView(productId);
            }
        });

        // Избранное
        document.addEventListener('click', (e) => {
            const wishlistBtn = e.target.closest('.wishlist-btn, .action-btn .fa-heart');
            if (wishlistBtn) {
                e.preventDefault();
                const productId = wishlistBtn.closest('.product-card').dataset.productId;
                this.toggleWishlist(productId, wishlistBtn);
            }
        });

        // Сравнение
        document.addEventListener('click', (e) => {
            const compareBtn = e.target.closest('.compare-btn, .action-btn .fa-exchange-alt');
            if (compareBtn) {
                e.preventDefault();
                const productId = compareBtn.closest('.product-card').dataset.productId;
                this.toggleCompare(productId, compareBtn);
            }
        });

        // Добавление в корзину
        document.addEventListener('click', (e) => {
            const addToCartBtn = e.target.closest('.btn-add-cart');
            if (addToCartBtn) {
                e.preventDefault();
                const productId = addToCartBtn.dataset.productId;
                this.addToCart(productId, addToCartBtn);
            }
        });

        // Мобильные фильтры
        const mobileFiltersBtn = document.getElementById('mobile-filters-btn');
        if (mobileFiltersBtn) {
            mobileFiltersBtn.addEventListener('click', () => this.toggleMobileFilters());
        }

        // Ресайз окна
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth < 768;
            this.updateResponsiveUI();
        });

        // Сохранение состояния перед закрытием
        window.addEventListener('beforeunload', () => this.saveState());
    }

    // Настройка Intersection Observer для ленивой загрузки
    setupIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            this.imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        const src = img.dataset.src;
                        if (src) {
                            img.src = src;
                            img.removeAttribute('data-src');
                        }
                        this.imageObserver.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.1
            });
        }
    }

    // Настройка Drag & Drop для сортировки
    setupDragAndDrop() {
        const productsGrid = document.getElementById('products-grid');
        if (!productsGrid) return;

        let draggedItem = null;

        productsGrid.addEventListener('dragstart', (e) => {
            if (e.target.closest('.product-card')) {
                draggedItem = e.target.closest('.product-card');
                e.dataTransfer.setData('text/plain', draggedItem.dataset.productId);
                draggedItem.classList.add('dragging');
            }
        });

        productsGrid.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(productsGrid, e.clientY);
            const draggable = document.querySelector('.dragging');
            
            if (afterElement == null) {
                productsGrid.appendChild(draggable);
            } else {
                productsGrid.insertBefore(draggable, afterElement);
            }
        });

        productsGrid.addEventListener('dragend', (e) => {
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                draggable.classList.remove('dragging');
                
                // Сохраняем порядок
                this.saveProductOrder();
            }
        });
    }

    // Получение элемента для вставки при Drag & Drop
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.product-card:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Применение фильтров
    applyFilters() {
        this.filteredProducts = [...this.products];
        
        // Фильтр по категории
        if (this.filters.category !== 'all') {
            this.filteredProducts = this.filteredProducts.filter(
                product => product.category === this.filters.category
            );
        }
        
        // Фильтр по цене
        this.filteredProducts = this.filteredProducts.filter(
            product => product.price >= this.filters.price.min && 
                      product.price <= this.filters.price.max
        );
        
        // Фильтр по брендам
        if (this.filters.brands.length > 0) {
            this.filteredProducts = this.filteredProducts.filter(
                product => this.filters.brands.includes(product.brand)
            );
        }
        
        // Фильтр по цветам
        if (this.filters.colors.length > 0) {
            this.filteredProducts = this.filteredProducts.filter(
                product => this.filters.colors.includes(product.color)
            );
        }
        
        // Фильтр по размерам
        if (this.filters.sizes.length > 0) {
            this.filteredProducts = this.filteredProducts.filter(
                product => this.filters.sizes.includes(product.size)
            );
        }
        
        // Фильтр по специальным признакам
        if (this.filters.specials.length > 0) {
            this.filteredProducts = this.filteredProducts.filter(product => {
                return this.filters.specials.some(special => {
                    if (special === 'new') return product.is_new;
                    if (special === 'sale') return product.discount > 0;
                    if (special === 'exclusive') return product.is_exclusive;
                    if (special === 'limited') return product.is_limited;
                    return false;
                });
            });
        }
        
        // Сортировка
        this.sortProducts();
        
        // Обновление пагинации
        this.updatePagination();
        
        // Обновление UI
        this.renderProducts();
        
        // Обновление статистики
        this.updateStats();
        
        // Сохранение фильтров
        this.saveFilters();
    }

    // Сортировка продуктов
    sortProducts() {
        const sortMethod = this.filters.sort || 'newest';
        
        switch (sortMethod) {
            case 'price-low':
                this.filteredProducts.sort((a, b) => {
                    const priceA = a.price * (1 - (a.discount || 0) / 100);
                    const priceB = b.price * (1 - (b.discount || 0) / 100);
                    return priceA - priceB;
                });
                break;
                
            case 'price-high':
                this.filteredProducts.sort((a, b) => {
                    const priceA = a.price * (1 - (a.discount || 0) / 100);
                    const priceB = b.price * (1 - (b.discount || 0) / 100);
                    return priceB - priceA;
                });
                break;
                
            case 'popular':
                this.filteredProducts.sort((a, b) => b.rating - a.rating);
                break;
                
            case 'discount':
                this.filteredProducts.sort((a, b) => (b.discount || 0) - (a.discount || 0));
                break;
                
            case 'rating':
                this.filteredProducts.sort((a, b) => b.rating - a.rating);
                break;
                
            case 'newest':
            default:
                this.filteredProducts.sort((a, b) => 
                    new Date(b.created_at) - new Date(a.created_at)
                );
                break;
        }
    }

    // Установка фильтра
    setFilter(filterName, value) {
        this.filters[filterName] = value;
        this.applyFilters();
    }

    // Переключение фильтра (для массивов)
    toggleFilter(filterName, value) {
        const filterArray = this.filters[filterName];
        const index = filterArray.indexOf(value);
        
        if (index === -1) {
            filterArray.push(value);
        } else {
            filterArray.splice(index, 1);
        }
        
        this.applyFilters();
    }

    // Обновление фильтра цены
    updatePriceFilter() {
        const minSlider = document.getElementById('range-min');
        const maxSlider = document.getElementById('range-max');
        const minPrice = document.getElementById('min-price');
        const maxPrice = document.getElementById('max-price');
        
        if (minSlider && maxSlider && minPrice && maxPrice) {
            this.filters.price = {
                min: parseInt(minSlider.value),
                max: parseInt(maxSlider.value)
            };
            
            minPrice.value = this.filters.price.min;
            maxPrice.value = this.filters.price.max;
            
            this.applyFilters();
        }
    }

    // Поиск продуктов
    searchProducts(query) {
        if (!query.trim()) {
            this.applyFilters();
            return;
        }
        
        const searchTerms = query.toLowerCase().split(' ');
        
        this.filteredProducts = this.products.filter(product => {
            const searchText = `
                ${product.name} 
                ${product.category} 
                ${product.brand} 
                ${product.color} 
                ${product.description}
            `.toLowerCase();
            
            return searchTerms.every(term => searchText.includes(term));
        });
        
        this.sortProducts();
        this.updatePagination();
        this.renderProducts();
        this.updateStats();
    }

    // Рендеринг продуктов
    renderProducts() {
        const productsGrid = document.getElementById('products-grid');
        if (!productsGrid) return;
        
        // Очищаем grid
        productsGrid.innerHTML = '';
        
        // Рассчитываем продукты для текущей страницы
        const startIndex = (this.currentPage - 1) * this.productsPerPage;
        const endIndex = startIndex + this.productsPerPage;
        const pageProducts = this.filteredProducts.slice(startIndex, endIndex);
        
        if (pageProducts.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // Рендерим продукты
        pageProducts.forEach(product => {
            const productCard = this.createProductCard(product);
            productsGrid.appendChild(productCard);
            
            // Наблюдаем за изображениями для ленивой загрузки
            const images = productCard.querySelectorAll('img[data-src]');
            images.forEach(img => {
                if (this.imageObserver) {
                    this.imageObserver.observe(img);
                }
            });
        });
        
        // Применяем настройки вида
        this.updateViewUI(this.filters.view);
        this.updateGridSize(this.filters.gridSize);
    }

    // Создание карточки продукта
    createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.productId = product.id;
        card.dataset.category = product.category;
        card.dataset.price = product.price;
        card.dataset.brand = product.brand;
        card.dataset.color = product.color;
        card.dataset.size = product.size;
        card.dataset.new = product.is_new;
        card.dataset.sale = product.discount > 0;
        card.dataset.exclusive = product.is_exclusive;
        card.dataset.limited = product.is_limited;
        card.draggable = true;
        
        const finalPrice = product.price * (1 - (product.discount || 0) / 100);
        
        card.innerHTML = `
            ${this.createProductBadges(product)}
            <div class="product-image">
                <img data-src="${product.image_url}" 
                     src="/static/images/placeholder.jpg" 
                     alt="${product.name}"
                     loading="lazy"
                     class="product-main-image">
                <div class="product-actions">
                    <button class="action-btn wishlist-btn" title="В избранное">
                        <i class="far fa-heart"></i>
                    </button>
                    <button class="action-btn quick-view-btn" title="Быстрый просмотр">
                        <i class="far fa-eye"></i>
                    </button>
                    <button class="action-btn compare-btn" title="Сравнить">
                        <i class="fas fa-exchange-alt"></i>
                    </button>
                </div>
                ${product.stock <= 5 ? '<div class="stock-badge">Осталось мало</div>' : ''}
            </div>
            <div class="product-info">
                <div class="product-category">${product.category}</div>
                <h3 class="product-title">
                    <a href="/product/${product.id}">${product.name}</a>
                </h3>
                <p class="product-description">${product.description}</p>
                
                <div class="product-meta">
                    <div class="product-price">
                        ${product.discount > 0 ? `
                            <span class="current-price">${finalPrice.toFixed(0)} €</span>
                            <span class="original-price">${product.price} €</span>
                        ` : `
                            <span class="current-price">${product.price} €</span>
                        `}
                    </div>
                    
                    <div class="product-rating">
                        <div class="stars">
                            ${this.generateStarRating(product.rating)}
                        </div>
                        <span class="rating-count">(${Math.floor(product.rating * 10)})</span>
                    </div>
                </div>
                
                <div class="product-footer">
                    <button class="btn-add-cart" data-product-id="${product.id}">
                        <i class="fas fa-shopping-bag"></i>
                        <span>В корзину</span>
                    </button>
                    <a href="/product/${product.id}" class="btn-view" title="Подробнее">
                        <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            </div>
        `;
        
        return card;
    }

    // Создание бейджей продукта
    createProductBadges(product) {
        let badges = '';
        
        if (product.is_new) {
            badges += '<span class="product-badge badge-new">Новинка</span>';
        }
        if (product.is_exclusive) {
            badges += '<span class="product-badge badge-exclusive">Эксклюзив</span>';
        }
        if (product.is_limited) {
            badges += '<span class="product-badge badge-limited">Лимитированная</span>';
        }
        if (product.discount > 0) {
            badges += `<span class="product-badge badge-sale">-${product.discount}%</span>`;
        }
        
        if (badges) {
            return `<div class="product-badges">${badges}</div>`;
        }
        
        return '';
    }

    // Генерация рейтинга звездами
    generateStarRating(rating) {
        let stars = '';
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        
        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i === fullStars + 1 && hasHalfStar) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        
        return stars;
    }

    // Обновление статистики
    updateStats() {
        const totalElement = document.querySelector('.catalog-stats strong');
        if (totalElement) {
            totalElement.textContent = this.filteredProducts.length;
        }
        
        const categoryElement = document.querySelector('.catalog-stats strong:nth-child(2)');
        if (categoryElement && this.filters.category !== 'all') {
            categoryElement.textContent = this.filters.category;
        }
    }

    // Обновление пагинации
    updatePagination() {
        this.totalPages = Math.ceil(this.filteredProducts.length / this.productsPerPage);
        this.currentPage = Math.min(this.currentPage, this.totalPages);
        
        const paginationContainer = document.querySelector('.catalog-pagination');
        if (!paginationContainer) return;
        
        paginationContainer.innerHTML = this.createPaginationHTML();
    }

    // Создание HTML пагинации
    createPaginationHTML() {
        if (this.totalPages <= 1) return '';
        
        let html = '';
        
        // Кнопка "Назад"
        html += `
            <a href="#" class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}" id="prev-page">
                <i class="fas fa-chevron-left"></i>
            </a>
        `;
        
        // Номера страниц
        const maxVisible = this.isMobile ? 3 : 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        if (startPage > 1) {
            html += `<a href="#" class="page-btn" data-page="1">1</a>`;
            if (startPage > 2) html += `<span class="page-btn disabled">...</span>`;
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <a href="#" class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">
                    ${i}
                </a>
            `;
        }
        
        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) html += `<span class="page-btn disabled">...</span>`;
            html += `<a href="#" class="page-btn" data-page="${this.totalPages}">${this.totalPages}</a>`;
        }
        
        // Кнопка "Вперед"
        html += `
            <a href="#" class="page-btn ${this.currentPage === this.totalPages ? 'disabled' : ''}" id="next-page">
                <i class="fas fa-chevron-right"></i>
            </a>
        `;
        
        return html;
    }

    // Переход на страницу
    goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;
        
        this.currentPage = page;
        this.renderProducts();
        this.updatePagination();
        
        // Прокрутка к верху каталога
        const catalogHeader = document.querySelector('.catalog-header');
        if (catalogHeader) {
            catalogHeader.scrollIntoView({ behavior: 'smooth' });
        }
        
        // Обновление URL
        this.updateURL();
    }

    // Обновление URL с параметрами
    updateURL() {
        const params = new URLSearchParams();
        
        if (this.filters.category !== 'all') {
            params.set('category', this.filters.category);
        }
        
        if (this.filters.price.min > 0 || this.filters.price.max < 100000) {
            params.set('price', `${this.filters.price.min}-${this.filters.price.max}`);
        }
        
        if (this.filters.brands.length > 0) {
            params.set('brands', this.filters.brands.join(','));
        }
        
        if (this.filters.sort !== 'newest') {
            params.set('sort', this.filters.sort);
        }
        
        if (this.currentPage > 1) {
            params.set('page', this.currentPage);
        }
        
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
    }

    // Показ пустого состояния
    showEmptyState() {
        const productsGrid = document.getElementById('products-grid');
        if (!productsGrid) return;
        
        productsGrid.innerHTML = `
            <div class="catalog-empty">
                <div class="catalog-empty-icon">
                    <i class="fas fa-search"></i>
                </div>
                <h2>Товары не найдены</h2>
                <p>Попробуйте изменить параметры фильтрации или выбрать другую категорию</p>
                <button class="clear-filters" id="clear-filters-empty">
                    <i class="fas fa-times"></i>
                    <span>Сбросить все фильтры</span>
                </button>
            </div>
        `;
        
        document.getElementById('clear-filters-empty').addEventListener('click', () => {
            this.resetFilters();
        });
    }

    // Показать загрузку
    showLoading() {
        this.isLoading = true;
        const productsGrid = document.getElementById('products-grid');
        if (productsGrid) {
            productsGrid.innerHTML = `
                <div class="catalog-loading">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <p>Загрузка товаров...</p>
                </div>
            `;
        }
    }

    // Скрыть загрузку
    hideLoading() {
        this.isLoading = false;
    }

    // Создание модального окна быстрого просмотра
    createQuickViewModal() {
        const modal = document.createElement('div');
        modal.id = 'quick-view-modal';
        modal.className = 'quick-view-modal';
        modal.innerHTML = `
            <div class="quick-view-content">
                <button class="quick-view-close">
                    <i class="fas fa-times"></i>
                </button>
                <div class="quick-view-body" id="quick-view-body">
                    <!-- Контент будет загружен динамически -->
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Закрытие по клику на крестик
        modal.querySelector('.quick-view-close').addEventListener('click', () => {
            this.hideQuickView();
        });
        
        // Закрытие по клику вне модалки
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideQuickView();
            }
        });
        
        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.hideQuickView();
            }
        });
    }

    // Показать быстрый просмотр
    async showQuickView(productId) {
        const product = this.products.find(p => p.id == productId);
        if (!product) return;
        
        const modal = document.getElementById('quick-view-modal');
        const body = document.getElementById('quick-view-body');
        
        // Показываем скелетон загрузки
        body.innerHTML = `
            <div class="quick-view-loading">
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Загружаем детальную информацию
        try {
            const response = await fetch(`/api/products/${productId}/quick-view`);
            const details = response.ok ? await response.json() : product;
            
            // Рендерим контент
            body.innerHTML = this.createQuickViewContent(details);
            
            // Инициализируем галерею
            this.initQuickViewGallery();
            
            // Инициализируем варианты
            this.initQuickViewVariants();
        } catch (error) {
            console.error('Ошибка загрузки быстрого просмотра:', error);
            body.innerHTML = '<p>Ошибка загрузки товара</p>';
        }
    }

    // Создание контента для быстрого просмотра
    createQuickViewContent(product) {
        const finalPrice = product.price * (1 - (product.discount || 0) / 100);
        
        return `
            <div class="quick-view-product">
                <div class="quick-view-gallery">
                    <div class="quick-view-main-image">
                        <img src="${product.image_url}" alt="${product.name}">
                    </div>
                    <div class="quick-view-thumbs">
                        <div class="quick-view-thumb active">
                            <img src="${product.image_url}" alt="${product.name}">
                        </div>
                        ${[2, 3, 4].map(i => `
                            <div class="quick-view-thumb">
                                <img src="${product.image_url}?v=${i}" alt="${product.name} - вид ${i}">
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="quick-view-info">
                    <div class="quick-view-header">
                        <div class="quick-view-category">${product.category}</div>
                        <h2 class="quick-view-title">${product.name}</h2>
                        <div class="quick-view-rating">
                            ${this.generateStarRating(product.rating)}
                            <span class="rating-count">(${Math.floor(product.rating * 10)} отзывов)</span>
                        </div>
                    </div>
                    
                    <div class="quick-view-price">
                        ${product.discount > 0 ? `
                            <div class="current-price">${finalPrice.toFixed(0)} €</div>
                            <div class="original-price">${product.price} €</div>
                            <div class="discount-badge">-${product.discount}%</div>
                        ` : `
                            <div class="current-price">${product.price} €</div>
                        `}
                    </div>
                    
                    <div class="quick-view-description">
                        <p>${product.description}</p>
                    </div>
                    
                    ${product.size || product.color ? `
                        <div class="quick-view-variants">
                            ${product.size ? `
                                <div class="variant-group">
                                    <label>Размер:</label>
                                    <div class="variant-options">
                                        ${product.size.split(',').map(s => `
                                            <button class="variant-option" data-variant="size" data-value="${s.trim()}">
                                                ${s.trim()}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${product.color ? `
                                <div class="variant-group">
                                    <label>Цвет:</label>
                                    <div class="variant-options">
                                        ${product.color.split(',').map(c => `
                                            <button class="variant-option color-option" 
                                                    data-variant="color" 
                                                    data-value="${c.trim()}"
                                                    style="background: ${this.getColorHex(c.trim())}">
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    <div class="quick-view-stock">
                        ${product.stock > 10 ? 
                            `<span class="in-stock"><i class="fas fa-check-circle"></i> В наличии (${product.stock} шт.)</span>` :
                            product.stock > 0 ?
                            `<span class="low-stock"><i class="fas fa-exclamation-circle"></i> Мало осталось (${product.stock} шт.)</span>` :
                            `<span class="out-of-stock"><i class="fas fa-times-circle"></i> Нет в наличии</span>`
                        }
                    </div>
                    
                    <div class="quick-view-actions">
                        <div class="quantity-selector">
                            <button class="quantity-btn decrease"><i class="fas fa-minus"></i></button>
                            <input type="number" class="quantity-input" value="1" min="1" max="${product.stock}">
                            <button class="quantity-btn increase"><i class="fas fa-plus"></i></button>
                        </div>
                        <button class="btn-add-to-cart" data-product-id="${product.id}">
                            <i class="fas fa-shopping-bag"></i>
                            <span>Добавить в корзину</span>
                        </button>
                        <button class="btn-wishlist" data-product-id="${product.id}">
                            <i class="far fa-heart"></i>
                        </button>
                    </div>
                    
                    <div class="quick-view-meta">
                        <div class="meta-item">
                            <i class="fas fa-tag"></i>
                            <span>Артикул: ${product.id}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-truck"></i>
                            <span>Бесплатная доставка от 20 000 €</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-undo"></i>
                            <span>30 дней на возврат</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Инициализация галереи быстрого просмотра
    initQuickViewGallery() {
        const thumbs = document.querySelectorAll('.quick-view-thumb');
        const mainImage = document.querySelector('.quick-view-main-image img');
        
        thumbs.forEach(thumb => {
            thumb.addEventListener('click', () => {
                // Убираем активный класс у всех
                thumbs.forEach(t => t.classList.remove('active'));
                // Добавляем активный класс текущему
                thumb.classList.add('active');
                // Обновляем главное изображение
                const thumbImg = thumb.querySelector('img');
                if (thumbImg && mainImage) {
                    mainImage.src = thumbImg.src;
                }
            });
        });
    }

    // Инициализация вариантов в быстром просмотре
    initQuickViewVariants() {
        const variantOptions = document.querySelectorAll('.variant-option');
        
        variantOptions.forEach(option => {
            option.addEventListener('click', () => {
                const variantType = option.dataset.variant;
                const value = option.dataset.value;
                
                // Убираем активный класс у всех вариантов этого типа
                document.querySelectorAll(`.variant-option[data-variant="${variantType}"]`)
                    .forEach(opt => opt.classList.remove('active'));
                
                // Добавляем активный класс текущему
                option.classList.add('active');
                
                // Обновляем выбор варианта
                console.log(`Выбран ${variantType}: ${value}`);
            });
        });
    }

    // Скрыть быстрый просмотр
    hideQuickView() {
        const modal = document.getElementById('quick-view-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Создание модального окна сравнения
    createCompareModal() {
        // Реализация модального окна сравнения
    }

    // Создание модального окна фильтров для мобильных
    createFiltersModal() {
        const modal = document.createElement('div');
        modal.id = 'filters-modal';
        modal.className = 'filters-modal';
        modal.innerHTML = `
            <div class="filters-modal-content">
                <div class="filters-modal-header">
                    <h3>Фильтры</h3>
                    <button class="filters-modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="filters-modal-body">
                    <!-- Фильтры будут скопированы из сайдбара -->
                </div>
                <div class="filters-modal-footer">
                    <button class="btn-secondary" id="reset-filters-mobile">Сбросить</button>
                    <button class="btn-primary" id="apply-filters-mobile">Применить</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // Переключение мобильных фильтров
    toggleMobileFilters() {
        const modal = document.getElementById('filters-modal');
        const sidebar = document.querySelector('.catalog-sidebar');
        
        if (!sidebar) return;
        
        // Копируем фильтры в модальное окно
        const filtersBody = modal.querySelector('.filters-modal-body');
        filtersBody.innerHTML = sidebar.innerHTML;
        
        // Показываем модальное окно
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Настройка тултипов
    setupTooltips() {
        const tooltipElements = document.querySelectorAll('[title]');
        
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                const title = element.getAttribute('title');
                if (!title) return;
                
                const tooltip = document.createElement('div');
                tooltip.className = 'custom-tooltip';
                tooltip.textContent = title;
                document.body.appendChild(tooltip);
                
                const rect = element.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
                tooltip.style.transform = 'translateX(-50%)';
                
                element.setAttribute('title', '');
                element.dataset.originalTitle = title;
                
                element.tooltip = tooltip;
            });
            
            element.addEventListener('mouseleave', () => {
                if (element.tooltip) {
                    element.tooltip.remove();
                    delete element.tooltip;
                }
                if (element.dataset.originalTitle) {
                    element.setAttribute('title', element.dataset.originalTitle);
                }
            });
        });
    }

    // Настройка карточек продуктов
    setupProductCards() {
        // Добавляем эффект при наведении
        document.addEventListener('mouseover', (e) => {
            const productCard = e.target.closest('.product-card');
            if (productCard) {
                productCard.classList.add('hover');
            }
        });
        
        document.addEventListener('mouseout', (e) => {
            const productCard = e.target.closest('.product-card');
            if (productCard) {
                productCard.classList.remove('hover');
            }
        });
    }

    // Обновление UI категории
    updateCategoryUI(selectedCategory) {
        document.querySelectorAll('.category-item').forEach(item => {
            const category = item.dataset.category || 'all';
            if (category === selectedCategory) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // Обновление UI фильтров
    updateFilterUI(element, filterType, value) {
        const checkbox = element.querySelector('.filter-checkbox');
        if (checkbox) {
            if (this.filters[filterType].includes(value)) {
                checkbox.classList.add('checked');
            } else {
                checkbox.classList.remove('checked');
            }
        }
    }

    // Обновление UI цвета
    updateColorUI(selectedElement) {
        document.querySelectorAll('.color-item').forEach(item => {
            item.classList.remove('active');
        });
        selectedElement.classList.add('active');
    }

    // Обновление UI размера
    updateSizeUI(selectedElement) {
        document.querySelectorAll('.size-item').forEach(item => {
            item.classList.remove('active');
        });
        selectedElement.classList.add('active');
    }

    // Обновление UI вида отображения
    updateViewUI(selectedView) {
        document.querySelectorAll('.view-btn').forEach(btn => {
            if (btn.dataset.view === selectedView) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        const productsGrid = document.getElementById('products-grid');
        if (productsGrid) {
            productsGrid.className = 'catalog-products-grid';
            productsGrid.classList.add(`${selectedView}-view`);
        }
    }

    // Обновление размера сетки
    updateGridSize(size) {
        const productsGrid = document.getElementById('products-grid');
        if (!productsGrid) return;
        
        let minWidth;
        switch(size) {
            case 1: minWidth = 350; break;
            case 2: minWidth = 280; break;
            case 3: minWidth = 240; break;
            default: minWidth = 280;
        }
        
        productsGrid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${minWidth}px, 1fr))`;
    }

    // Обновление адаптивного UI
    updateResponsiveUI() {
        if (this.isMobile) {
            this.updateGridSize(1);
        } else {
            this.updateGridSize(this.filters.gridSize);
        }
    }

    // Сброс всех фильтров
    resetFilters() {
        this.filters = {
            category: 'all',
            price: { min: 0, max: 100000 },
            brands: [],
            colors: [],
            sizes: [],
            specials: [],
            sort: 'newest',
            view: 'grid',
            gridSize: 2
        };
        
        // Сброс UI
        this.updateCategoryUI('all');
        this.updatePriceInputs();
        this.resetFilterCheckboxes();
        this.resetColorSelection();
        this.resetSizeSelection();
        
        this.applyFilters();
        this.showNotification('Фильтры сброшены', 'info');
    }

    // Сброс инпутов цены
    updatePriceInputs() {
        const minSlider = document.getElementById('range-min');
        const maxSlider = document.getElementById('range-max');
        const minPrice = document.getElementById('min-price');
        const maxPrice = document.getElementById('max-price');
        const progress = document.querySelector('.price-slider .progress');
        
        if (minSlider && maxSlider && minPrice && maxPrice && progress) {
            minSlider.value = 0;
            maxSlider.value = 100000;
            minPrice.value = 0;
            maxPrice.value = 100000;
            progress.style.left = '0%';
            progress.style.right = '0%';
        }
    }

    // Сброс чекбоксов фильтров
    resetFilterCheckboxes() {
        document.querySelectorAll('.filter-checkbox').forEach(checkbox => {
            checkbox.classList.remove('checked');
        });
    }

    // Сброс выбора цвета
    resetColorSelection() {
        document.querySelectorAll('.color-item').forEach((item, index) => {
            if (index === 0) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // Сброс выбора размера
    resetSizeSelection() {
        document.querySelectorAll('.size-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    // Получение цвета из элемента
    getColorFromElement(element) {
        const style = window.getComputedStyle(element);
        const bgColor = style.backgroundColor;
        
        // Преобразуем RGB в название цвета
        const colorMap = {
            'rgb(0, 0, 0)': 'черный',
            'rgb(255, 255, 255)': 'белый',
            'rgb(196, 30, 58)': 'красный',
            'rgb(15, 82, 186)': 'синий',
            'rgb(80, 200, 120)': 'зеленый',
            'rgb(255, 215, 0)': 'золотой',
            'rgb(192, 192, 192)': 'серебряный',
            'rgb(128, 0, 128)': 'фиолетовый',
            'rgb(255, 107, 107)': 'розовый',
            'rgb(150, 75, 0)': 'коричневый',
            'rgb(128, 128, 128)': 'серый',
            'rgb(255, 165, 0)': 'оранжевый'
        };
        
        return colorMap[bgColor] || 'черный';
    }

    // Получение HEX цвета по названию
    getColorHex(colorName) {
        const colorMap = {
            'черный': '#000000',
            'белый': '#ffffff',
            'красный': '#c41e3a',
            'синий': '#0f52ba',
            'зеленый': '#50c878',
            'золотой': '#ffd700',
            'серебряный': '#c0c0c0',
            'фиолетовый': '#800080',
            'розовый': '#ff6b6b',
            'коричневый': '#964b00',
            'серый': '#808080',
            'оранжевый': '#ffa500'
        };
        
        return colorMap[colorName.toLowerCase()] || '#000000';
    }

    // Переключение избранного
    toggleWishlist(productId, button) {
        const isActive = button.classList.contains('active');
        const icon = button.querySelector('i');
        
        if (isActive) {
            // Удаляем из избранного
            button.classList.remove('active');
            icon.className = 'far fa-heart';
            this.showNotification('Удалено из избранного', 'info');
        } else {
            // Добавляем в избранное
            button.classList.add('active');
            icon.className = 'fas fa-heart';
            this.showNotification('Добавлено в избранное', 'success');
            
            // Анимация сердца
            this.animateHeart(button);
        }
        
        // Сохраняем в LocalStorage
        this.saveWishlistState(productId, !isActive);
    }

    // Переключение сравнения
    toggleCompare(productId, button) {
        const isActive = button.classList.contains('active');
        const icon = button.querySelector('i');
        
        if (isActive) {
            button.classList.remove('active');
            icon.style.color = '';
            this.showNotification('Удалено из сравнения', 'info');
        } else {
            button.classList.add('active');
            icon.style.color = 'var(--gold)';
            this.showNotification('Добавлено к сравнению', 'success');
        }
        
        // Сохраняем в LocalStorage
        this.saveCompareState(productId, !isActive);
    }

    // Добавление в корзину
    addToCart(productId, button) {
        const product = this.products.find(p => p.id == productId);
        if (!product) return;
        
        // Анимация кнопки
        const originalHTML = button.innerHTML;
        button.innerHTML = `
            <i class="fas fa-check"></i>
            <span>Добавлено!</span>
        `;
        button.style.background = '#10b981';
        button.disabled = true;
        
        // Показываем уведомление
        this.showNotification(`${product.name} добавлен в корзину`, 'success');
        
        // Восстанавливаем кнопку через 2 секунды
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.style.background = '';
            button.disabled = false;
        }, 2000);
        
        // Отправляем событие в глобальную корзину
        if (window.cart) {
            window.cart.addItem(productId, 1);
        }
    }

    // Анимация сердца для избранного
    animateHeart(button) {
        const heart = button.querySelector('i');
        heart.style.transform = 'scale(1.5)';
        
        setTimeout(() => {
            heart.style.transform = 'scale(1)';
        }, 300);
    }

    // Сохранение состояния избранного
    saveWishlistState(productId, isInWishlist) {
        try {
            const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
            const index = wishlist.indexOf(productId);
            
            if (isInWishlist && index === -1) {
                wishlist.push(productId);
            } else if (!isInWishlist && index !== -1) {
                wishlist.splice(index, 1);
            }
            
            localStorage.setItem('wishlist', JSON.stringify(wishlist));
        } catch (error) {
            console.error('Ошибка сохранения избранного:', error);
        }
    }

    // Сохранение состояния сравнения
    saveCompareState(productId, isInCompare) {
        try {
            const compare = JSON.parse(localStorage.getItem('compare') || '[]');
            const index = compare.indexOf(productId);
            
            if (isInCompare && index === -1) {
                compare.push(productId);
            } else if (!isInCompare && index !== -1) {
                compare.splice(index, 1);
            }
            
            localStorage.setItem('compare', JSON.stringify(compare));
        } catch (error) {
            console.error('Ошибка сохранения сравнения:', error);
        }
    }

    // Сохранение фильтров
    saveFilters() {
        try {
            localStorage.setItem('catalog_filters', JSON.stringify(this.filters));
        } catch (error) {
            console.error('Ошибка сохранения фильтров:', error);
        }
    }

    // Сохранение порядка продуктов
    saveProductOrder() {
        const productsGrid = document.getElementById('products-grid');
        if (!productsGrid) return;
        
        const productIds = Array.from(productsGrid.querySelectorAll('.product-card'))
            .map(card => card.dataset.productId);
        
        try {
            localStorage.setItem('product_order', JSON.stringify(productIds));
        } catch (error) {
            console.error('Ошибка сохранения порядка:', error);
        }
    }

    // Сохранение состояния
    saveState() {
        this.saveFilters();
        this.saveProductOrder();
    }

    // Восстановление состояния
    restoreState() {
        try {
            // Восстанавливаем фильтры
            const savedFilters = localStorage.getItem('catalog_filters');
            if (savedFilters) {
                this.filters = JSON.parse(savedFilters);
            }
            
            // Восстанавливаем порядок продуктов
            const savedOrder = localStorage.getItem('product_order');
            if (savedOrder) {
                const order = JSON.parse(savedOrder);
                this.reorderProducts(order);
            }
            
            // Восстанавливаем UI
            this.restoreUIState();
        } catch (error) {
            console.error('Ошибка восстановления состояния:', error);
        }
    }

    // Переупорядочивание продуктов
    reorderProducts(order) {
        const orderedProducts = [];
        const unorderedProducts = [...this.products];
        
        order.forEach(productId => {
            const index = unorderedProducts.findIndex(p => p.id == productId);
            if (index !== -1) {
                orderedProducts.push(unorderedProducts[index]);
                unorderedProducts.splice(index, 1);
            }
        });
        
        this.products = [...orderedProducts, ...unorderedProducts];
    }

    // Восстановление UI состояния
    restoreUIState() {
        // Восстанавливаем активную категорию
        if (this.filters.category) {
            this.updateCategoryUI(this.filters.category);
        }
        
        // Восстанавливаем вид отображения
        if (this.filters.view) {
            this.updateViewUI(this.filters.view);
        }
        
        // Восстанавливаем размер сетки
        if (this.filters.gridSize) {
            const gridSlider = document.getElementById('grid-size');
            if (gridSlider) {
                gridSlider.value = this.filters.gridSize;
                this.updateGridSize(this.filters.gridSize);
            }
        }
        
        // Восстанавливаем сортировку
        if (this.filters.sort) {
            const sortSelect = document.getElementById('sort-select');
            if (sortSelect) {
                sortSelect.value = this.filters.sort;
            }
        }
    }

    // Показать уведомление
    showNotification(message, type = 'info') {
        // Используем существующую систему уведомлений или создаем свою
        if (window.showNotification) {
            window.showNotification(message, type);
            return;
        }
        
        // Создаем свое уведомление
        const notification = document.createElement('div');
        notification.className = `catalog-notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Получение цвета уведомления
    getNotificationColor(type) {
        const colors = {
            'success': '#10b981',
            'error': '#ef4444',
            'warning': '#f59e0b',
            'info': 'var(--gold)'
        };
        return colors[type] || colors.info;
    }

    // Добавление CSS анимаций
    addAnimations() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
            
            .product-card {
                transition: all 0.3s ease;
            }
            
            .product-card.hover {
                transform: translateY(-5px);
                box-shadow: var(--shadow-gold);
            }
            
            .product-card.dragging {
                opacity: 0.5;
                transform: rotate(5deg);
            }
            
            .catalog-loading {
                grid-column: 1 / -1;
                text-align: center;
                padding: 60px 0;
            }
            
            .loading-spinner {
                font-size: 3rem;
                color: var(--gold);
                margin-bottom: 20px;
            }
            
            .quick-view-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 9999;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            .quick-view-modal.active {
                display: flex;
            }
            
            .quick-view-content {
                background: var(--card-bg);
                border-radius: var(--radius-xl);
                max-width: 900px;
                max-height: 90vh;
                overflow: auto;
                position: relative;
                animation: modalSlideIn 0.3s ease;
            }
            
            @keyframes modalSlideIn {
                from {
                    transform: translateY(-50px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            
            .quick-view-close {
                position: absolute;
                top: 20px;
                right: 20px;
                width: 40px;
                height: 40px;
                background: var(--card-bg);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-primary);
                z-index: 1;
                transition: all 0.3s ease;
            }
            
            .quick-view-close:hover {
                background: var(--gold);
                color: white;
                transform: rotate(90deg);
            }
            
            .filters-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 9998;
                display: none;
            }
            
            .filters-modal.active {
                display: block;
            }
            
            .filters-modal-content {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: var(--card-bg);
                border-radius: var(--radius-xl) var(--radius-xl) 0 0;
                max-height: 80vh;
                overflow: auto;
                animation: modalSlideUp 0.3s ease;
            }
            
            @keyframes modalSlideUp {
                from {
                    transform: translateY(100%);
                }
                to {
                    transform: translateY(0);
                }
            }
            
            .stock-badge {
                position: absolute;
                bottom: 10px;
                left: 10px;
                background: #f59e0b;
                color: white;
                padding: 4px 8px;
                border-radius: var(--radius-sm);
                font-size: 0.8rem;
                font-weight: 600;
            }
        `;
        document.head.appendChild(style);
    }
}

// Инициализация каталога при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем анимации
    const catalogManager = new CatalogManager();
    catalogManager.addAnimations();
    
    // Создаем глобальный объект каталога
    window.catalog = catalogManager;
    
    console.log('Модуль каталога инициализирован');
});

// Экспорт для использования в других модулях
export default CatalogManager;