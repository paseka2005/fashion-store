// main.js - Центральный модуль управления интернет-магазином VOGUE ÉLITE

class VogueEliteApp {
    constructor() {
        this.config = {
            apiBase: '/api',
            siteName: 'VOGUE ÉLITE',
            currency: '€',
            currencySymbol: '€',
            language: 'ru',
            theme: 'dark-nude',
            debug: false
        };
        
        this.modules = {
            cart: null,
            catalog: null,
            auth: null,
            notifications: null,
            analytics: null,
            ui: null
        };
        
        this.state = {
            user: null,
            cart: { items: [], total: 0 },
            wishlist: [],
            compare: [],
            notifications: [],
            preferences: {},
            session: {
                id: this.generateSessionId(),
                startTime: Date.now(),
                pageViews: 0,
                interactions: 0
            }
        };
        
        this.init();
    }

    // Инициализация приложения
    async init() {
        console.log('🚀 Инициализация VOGUE ÉLITE приложения...');
        
        // Устанавливаем конфигурацию
        this.setConfigFromMeta();
        
        // Инициализируем базовые модули
        await this.initializeCoreModules();
        
        // Настраиваем обработчики событий
        this.setupGlobalEventListeners();
        
        // Настраиваем UI компоненты
        this.setupUIComponents();
        
        // Загружаем пользовательские данные
        await this.loadUserData();
        
        // Настраиваем аналитику
        this.setupAnalytics();
        
        // Настраиваем Service Worker (если поддерживается)
        this.setupServiceWorker();
        
        // Запускаем периодические задачи
        this.startPeriodicTasks();
        
        // Отправляем событие инициализации
        this.dispatchEvent('app:initialized');
        
        console.log('✅ VOGUE ÉLITE успешно инициализирован');
    }

    // Установка конфигурации из meta тегов
    setConfigFromMeta() {
        const metaConfig = document.querySelector('meta[name="app-config"]');
        if (metaConfig) {
            try {
                const config = JSON.parse(metaConfig.content);
                Object.assign(this.config, config);
            } catch (error) {
                console.error('Ошибка парсинга конфигурации:', error);
            }
        }
    }

    // Инициализация основных модулей
    async initializeCoreModules() {
        // Инициализируем систему уведомлений
        this.modules.notifications = new NotificationManager();
        
        // Инициализируем UI менеджер
        this.modules.ui = new UIManager();
        
        // Инициализируем систему аутентификации
        this.modules.auth = new AuthManager();
        
        // Загружаем корзину
        await this.initializeCart();
        
        // Инициализируем каталог (если на странице каталога)
        if (this.isCatalogPage()) {
            await this.initializeCatalog();
        }
        
        // Инициализируем аналитику
        this.modules.analytics = new AnalyticsManager();
    }

    // Инициализация корзины
    async initializeCart() {
        try {
            // Проверяем наличие модуля корзины
            if (typeof CartManager !== 'undefined') {
                this.modules.cart = new CartManager();
            } else {
                // Создаем базовую корзину
                this.modules.cart = this.createBasicCart();
            }
            
            // Загружаем корзину с сервера
            await this.loadCartFromServer();
            
        } catch (error) {
            console.error('Ошибка инициализации корзины:', error);
            this.modules.cart = this.createBasicCart();
        }
    }

    // Создание базовой корзины
    createBasicCart() {
        return {
            items: [],
            total: 0,
            addItem: (productId, quantity, options) => {
                console.log('Добавление в корзину:', { productId, quantity, options });
                this.showNotification('Товар добавлен в корзину', 'success');
                this.updateCartUI();
            },
            updateQuantity: () => {},
            removeItem: () => {},
            clearCart: () => {},
            getTotalItems: () => this.modules.cart.items.length,
            getTotalPrice: () => this.modules.cart.total
        };
    }

    // Инициализация каталога
    async initializeCatalog() {
        try {
            if (typeof CatalogManager !== 'undefined') {
                this.modules.catalog = new CatalogManager();
            }
        } catch (error) {
            console.error('Ошибка инициализации каталога:', error);
        }
    }

    // Загрузка корзины с сервера
    async loadCartFromServer() {
        try {
            const response = await fetch(`${this.config.apiBase}/cart`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const cartData = await response.json();
                this.state.cart = cartData;
                this.updateCartUI();
            }
        } catch (error) {
            console.error('Ошибка загрузки корзины:', error);
        }
    }

    // Загрузка пользовательских данных
    async loadUserData() {
        try {
            // Проверяем авторизацию
            const response = await fetch(`${this.config.apiBase}/auth/check`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const userData = await response.json();
                this.state.user = userData;
                this.updateUserUI();
                
                // Загружаем избранное
                await this.loadWishlist();
                
                // Загружаем список сравнения
                await this.loadCompareList();
                
                // Загружаем предпочтения
                await this.loadUserPreferences();
            }
        } catch (error) {
            console.error('Ошибка загрузки пользовательских данных:', error);
        }
    }

    // Загрузка избранного
    async loadWishlist() {
        try {
            const response = await fetch(`${this.config.apiBase}/wishlist`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                this.state.wishlist = await response.json();
                this.updateWishlistUI();
            }
        } catch (error) {
            console.error('Ошибка загрузки избранного:', error);
        }
    }

    // Загрузка списка сравнения
    async loadCompareList() {
        try {
            const response = await fetch(`${this.config.apiBase}/compare`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                this.state.compare = await response.json();
                this.updateCompareUI();
            }
        } catch (error) {
            console.error('Ошибка загрузки списка сравнения:', error);
        }
    }

    // Загрузка пользовательских предпочтений
    async loadUserPreferences() {
        try {
            const savedPrefs = localStorage.getItem('user_preferences');
            if (savedPrefs) {
                this.state.preferences = JSON.parse(savedPrefs);
                this.applyUserPreferences();
            }
        } catch (error) {
            console.error('Ошибка загрузки предпочтений:', error);
        }
    }

    // Применение пользовательских предпочтений
    applyUserPreferences() {
        // Применяем тему
        if (this.state.preferences.theme) {
            document.documentElement.setAttribute('data-theme', this.state.preferences.theme);
        }
        
        // Применяем размер текста
        if (this.state.preferences.fontSize) {
            document.documentElement.style.fontSize = this.state.preferences.fontSize;
        }
        
        // Применяем валюту
        if (this.state.preferences.currency) {
            this.config.currency = this.state.preferences.currency;
            this.updateCurrencyDisplay();
        }
    }

    // Настройка глобальных обработчиков событий
    setupGlobalEventListeners() {
        // Навигация
        document.addEventListener('click', this.handleNavigation.bind(this));
        
        // Формы
        document.addEventListener('submit', this.handleFormSubmit.bind(this));
        
        // Клавиатура
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // События видимости страницы
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        
        // События онлайн/оффлайн
        window.addEventListener('online', this.handleOnlineStatus.bind(this));
        window.addEventListener('offline', this.handleOfflineStatus.bind(this));
        
        // События прокрутки
        window.addEventListener('scroll', this.handleScroll.bind(this));
        
        // Ресайз окна
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // События тач-устройств
        this.setupTouchEvents();
    }

    // Обработка навигации
    handleNavigation(e) {
        const link = e.target.closest('a');
        if (!link) return;
        
        const href = link.getAttribute('href');
        const isExternal = link.target === '_blank' || link.rel === 'external';
        const isHashLink = href && href.startsWith('#');
        
        // Игнорируем внешние ссылки и hash ссылки
        if (isExternal || isHashLink) return;
        
        // Игнорируем якорные ссылки
        if (href.includes('#')) {
            const anchor = href.split('#')[1];
            this.scrollToAnchor(anchor);
            return;
        }
        
        // Предотвращаем стандартное поведение для AJAX навигации
        if (this.config.enableAjaxNavigation && href && !href.startsWith('http')) {
            e.preventDefault();
            this.navigateTo(href);
        }
        
        // Отслеживаем клик в аналитике
        this.trackEvent('navigation', 'click', {
            href: href,
            text: link.textContent.trim(),
            position: this.getElementPosition(link)
        });
    }

    // AJAX навигация
    async navigateTo(url) {
        try {
            // Показываем индикатор загрузки
            this.showLoading();
            
            // Загружаем контент
            const response = await fetch(url);
            const html = await response.text();
            
            // Парсим HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Обновляем контент
            this.updatePageContent(doc);
            
            // Обновляем URL
            window.history.pushState({}, '', url);
            
            // Отправляем событие навигации
            this.dispatchEvent('app:navigated', { url });
            
        } catch (error) {
            console.error('Ошибка навигации:', error);
            window.location.href = url;
        } finally {
            this.hideLoading();
        }
    }

    // Обновление контента страницы
    updatePageContent(newDoc) {
        // Обновляем основной контент
        const mainContent = document.querySelector('main');
        const newContent = newDoc.querySelector('main');
        
        if (mainContent && newContent) {
            mainContent.innerHTML = newContent.innerHTML;
        }
        
        // Обновляем заголовок
        document.title = newDoc.title;
        
        // Обновляем meta теги
        this.updateMetaTags(newDoc);
        
        // Инициализируем компоненты новой страницы
        this.initializePageComponents();
        
        // Прокручиваем к верху
        window.scrollTo(0, 0);
    }

    // Обработка отправки форм
    handleFormSubmit(e) {
        const form = e.target.closest('form');
        if (!form) return;
        
        const isAjaxForm = form.classList.contains('ajax-form') || 
                          form.dataset.ajax === 'true';
        
        if (isAjaxForm) {
            e.preventDefault();
            this.submitFormAjax(form);
        }
        
        // Отслеживаем отправку формы
        this.trackEvent('form', 'submit', {
            formId: form.id || 'unknown',
            action: form.action
        });
    }

    // AJAX отправка формы
    async submitFormAjax(form) {
        try {
            // Показываем индикатор загрузки
            const submitBtn = form.querySelector('[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerHTML : null;
            
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка...';
                submitBtn.disabled = true;
            }
            
            // Подготавливаем данные
            const formData = new FormData(form);
            const isMultipart = form.enctype === 'multipart/form-data';
            
            const response = await fetch(form.action, {
                method: form.method,
                body: isMultipart ? formData : new URLSearchParams(formData),
                headers: isMultipart ? {} : {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                
                if (result.success) {
                    this.showNotification(result.message || 'Успешно!', 'success');
                    
                    // Перенаправление если указано
                    if (result.redirect) {
                        setTimeout(() => {
                            window.location.href = result.redirect;
                        }, 1500);
                    }
                    
                    // Сброс формы если нужно
                    if (result.resetForm) {
                        form.reset();
                    }
                    
                    // Обновление UI если нужно
                    if (result.updateUI) {
                        this.updateUIComponents(result.data);
                    }
                    
                } else {
                    this.showNotification(result.message || 'Ошибка!', 'error');
                    
                    // Показываем ошибки валидации
                    if (result.errors) {
                        this.showFormErrors(form, result.errors);
                    }
                }
            }
            
        } catch (error) {
            console.error('Ошибка отправки формы:', error);
            this.showNotification('Ошибка соединения', 'error');
        } finally {
            // Восстанавливаем кнопку
            const submitBtn = form.querySelector('[type="submit"]');
            if (submitBtn && originalText) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    // Обработка нажатия клавиш
    handleKeyDown(e) {
        // Глобальные горячие клавиши
        switch(e.key) {
            case 'Escape':
                this.closeAllModals();
                break;
                
            case '/':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.focusSearch();
                }
                break;
                
            case 's':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.savePageState();
                }
                break;
        }
        
        // Доступность: управление с клавиатуры
        if (e.key === 'Tab') {
            this.handleTabNavigation(e);
        }
    }

    // Обработка изменения видимости страницы
    handleVisibilityChange() {
        if (document.hidden) {
            this.dispatchEvent('app:pageHidden');
            this.state.session.lastHiddenTime = Date.now();
        } else {
            this.dispatchEvent('app:pageVisible');
            
            // Обновляем время сессии
            if (this.state.session.lastHiddenTime) {
                this.state.session.hiddenDuration += Date.now() - this.state.session.lastHiddenTime;
            }
        }
    }

    // Обработка изменения онлайн статуса
    handleOnlineStatus() {
        this.showNotification('Соединение восстановлено', 'success');
        this.dispatchEvent('app:online');
        
        // Синхронизируем данные
        this.syncOfflineData();
    }

    handleOfflineStatus() {
        this.showNotification('Вы offline. Некоторые функции ограничены', 'warning');
        this.dispatchEvent('app:offline');
    }

    // Обработка прокрутки
    handleScroll() {
        const scrollPosition = window.pageYOffset;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // Показываем/скрываем кнопку "Наверх"
        this.toggleScrollToTopButton(scrollPosition);
        
        // Загрузка при прокрутке до конца (бесконечный скролл)
        if (scrollPosition + windowHeight >= documentHeight - 100) {
            this.handleInfiniteScroll();
        }
        
        // Параллакс эффекты
        this.applyParallaxEffects(scrollPosition);
        
        // Отслеживаем прокрутку для аналитики
        this.trackScrollDepth(scrollPosition, documentHeight);
    }

    // Обработка ресайза окна
    handleResize() {
        this.dispatchEvent('app:resize', {
            width: window.innerWidth,
            height: window.innerHeight,
            isMobile: window.innerWidth < 768
        });
        
        // Обновляем адаптивные компоненты
        this.updateResponsiveComponents();
    }

    // Настройка тач событий
    setupTouchEvents() {
        // Предотвращаем масштабирование при дабл-тапе
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // Свайп для мобильной навигации
        this.setupSwipeGestures();
    }

    // Настройка жестов свайпа
    setupSwipeGestures() {
        let startX, startY, endX, endY;
        
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        
        document.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            endY = e.changedTouches[0].clientY;
            
            const diffX = startX - endX;
            const diffY = startY - endY;
            
            // Определяем направление свайпа
            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX > 50) {
                    // Свайп влево
                    this.handleSwipe('left');
                } else if (diffX < -50) {
                    // Свайп вправо
                    this.handleSwipe('right');
                }
            } else {
                if (diffY > 50) {
                    // Свайп вверх
                    this.handleSwipe('up');
                } else if (diffY < -50) {
                    // Свайп вниз
                    this.handleSwipe('down');
                }
            }
        });
    }

    // Настройка UI компонентов
    setupUIComponents() {
        // Инициализация модальных окон
        this.initializeModals();
        
        // Инициализация выпадающих меню
        this.initializeDropdowns();
        
        // Инициализация табов
        this.initializeTabs();
        
        // Инициализация аккордеонов
        this.initializeAccordions();
        
        // Инициализация слайдеров
        this.initializeSliders();
        
        // Инициализация тултипов
        this.initializeTooltips();
        
        // Инициализация ленивой загрузки
        this.initializeLazyLoad();
        
        // Инициализация анимаций
        this.initializeAnimations();
    }

    // Инициализация модальных окон
    initializeModals() {
        document.querySelectorAll('[data-modal]').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                const modalId = trigger.dataset.modal;
                this.openModal(modalId);
            });
        });
        
        // Закрытие по клику на оверлей
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
        
        // Закрытие по крестику
        document.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const modal = closeBtn.closest('.modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    // Открытие модального окна
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Фокус на первом интерактивном элементе
        const focusElement = modal.querySelector('input, button, [tabindex]');
        if (focusElement) {
            setTimeout(() => focusElement.focus(), 100);
        }
        
        this.dispatchEvent('modal:opened', { modalId });
    }

    // Закрытие модального окна
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        this.dispatchEvent('modal:closed', { modalId });
    }

    // Закрытие всех модальных окон
    closeAllModals() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            this.closeModal(modal.id);
        });
    }

    // Инициализация выпадающих меню
    initializeDropdowns() {
        document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const dropdown = toggle.closest('.dropdown');
                const isActive = dropdown.classList.contains('active');
                
                // Закрываем все другие dropdowns
                document.querySelectorAll('.dropdown.active').forEach(d => {
                    if (d !== dropdown) {
                        d.classList.remove('active');
                    }
                });
                
                // Переключаем текущий dropdown
                dropdown.classList.toggle('active', !isActive);
            });
        });
        
        // Закрытие dropdown при клике вне
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown.active').forEach(dropdown => {
                    dropdown.classList.remove('active');
                });
            }
        });
        
        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.dropdown.active').forEach(dropdown => {
                    dropdown.classList.remove('active');
                });
            }
        });
    }

    // Инициализация табов
    initializeTabs() {
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                
                const tabId = tab.dataset.tab;
                const tabsContainer = tab.closest('.tabs');
                
                if (!tabId || !tabsContainer) return;
                
                // Убираем активный класс у всех табов
                tabsContainer.querySelectorAll('.tab-btn').forEach(t => {
                    t.classList.remove('active');
                });
                
                // Добавляем активный класс текущему табу
                tab.classList.add('active');
                
                // Скрываем все таб-контенты
                tabsContainer.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Показываем выбранный таб-контент
                const tabContent = document.getElementById(`${tabId}-content`);
                if (tabContent) {
                    tabContent.classList.add('active');
                }
                
                this.dispatchEvent('tabs:changed', { tabId });
            });
        });
    }

    // Инициализация аккордеонов
    initializeAccordions() {
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const accordion = header.closest('.accordion');
                const isActive = accordion.classList.contains('active');
                
                // Закрываем все другие аккордеоны если нужно
                if (accordion.dataset.single) {
                    document.querySelectorAll('.accordion.active').forEach(acc => {
                        if (acc !== accordion) {
                            acc.classList.remove('active');
                        }
                    });
                }
                
                // Переключаем текущий аккордеон
                accordion.classList.toggle('active', !isActive);
                
                // Анимация высоты
                const content = accordion.querySelector('.accordion-content');
                if (content) {
                    if (!isActive) {
                        content.style.maxHeight = content.scrollHeight + 'px';
                    } else {
                        content.style.maxHeight = '0';
                    }
                }
            });
        });
    }

    // Инициализация слайдеров
    initializeSliders() {
        document.querySelectorAll('.slider').forEach(slider => {
            const slides = slider.querySelectorAll('.slide');
            const prevBtn = slider.querySelector('.slider-prev');
            const nextBtn = slider.querySelector('.slider-next');
            const dots = slider.querySelectorAll('.slider-dot');
            
            let currentSlide = 0;
            const totalSlides = slides.length;
            
            const goToSlide = (index) => {
                currentSlide = (index + totalSlides) % totalSlides;
                
                // Обновляем видимый слайд
                slides.forEach((slide, i) => {
                    slide.classList.toggle('active', i === currentSlide);
                });
                
                // Обновляем точки
                dots.forEach((dot, i) => {
                    dot.classList.toggle('active', i === currentSlide);
                });
                
                // Обновляем позицию слайдера
                slider.style.transform = `translateX(-${currentSlide * 100}%)`;
            };
            
            // Кнопки навигации
            if (prevBtn) {
                prevBtn.addEventListener('click', () => goToSlide(currentSlide - 1));
            }
            
            if (nextBtn) {
                nextBtn.addEventListener('click', () => goToSlide(currentSlide + 1));
            }
            
            // Точки навигации
            dots.forEach((dot, index) => {
                dot.addEventListener('click', () => goToSlide(index));
            });
            
            // Автопрокрутка
            if (slider.dataset.autoplay === 'true') {
                setInterval(() => {
                    goToSlide(currentSlide + 1);
                }, parseInt(slider.dataset.interval || 5000));
            }
            
            // Swipe для мобильных
            this.setupSliderSwipe(slider, goToSlide);
        });
    }

    // Инициализация тултипов
    initializeTooltips() {
        const tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        document.body.appendChild(tooltip);
        
        document.querySelectorAll('[title]').forEach(element => {
            const title = element.getAttribute('title');
            if (!title) return;
            
            element.addEventListener('mouseenter', (e) => {
                tooltip.textContent = title;
                tooltip.style.display = 'block';
                
                const rect = element.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
                tooltip.style.transform = 'translateX(-50%)';
            });
            
            element.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
            
            // Убираем стандартный title
            element.removeAttribute('title');
            element.dataset.originalTitle = title;
        });
    }

    // Инициализация ленивой загрузки
    initializeLazyLoad() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        const src = img.dataset.src;
                        
                        if (src) {
                            img.src = src;
                            img.removeAttribute('data-src');
                        }
                        
                        imageObserver.unobserve(img);
                    }
                });
            });
            
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    // Инициализация анимаций
    initializeAnimations() {
        if ('IntersectionObserver' in window) {
            const animationObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate');
                    }
                });
            }, {
                threshold: 0.1
            });
            
            document.querySelectorAll('.animate-on-scroll').forEach(element => {
                animationObserver.observe(element);
            });
        }
    }

    // Обновление UI корзины
    updateCartUI() {
        const totalItems = this.modules.cart.getTotalItems();
        const totalPrice = this.modules.cart.getTotalPrice();
        
        // Обновляем счетчики
        document.querySelectorAll('.cart-count').forEach(element => {
            element.textContent = totalItems;
            element.style.display = totalItems > 0 ? 'flex' : 'none';
        });
        
        // Обновляем общую сумму
        document.querySelectorAll('.cart-total').forEach(element => {
            element.textContent = `${totalPrice.toFixed(2)} ${this.config.currencySymbol}`;
        });
        
        // Обновляем иконку корзины
        document.querySelectorAll('.cart-icon').forEach(icon => {
            if (totalItems > 0) {
                icon.classList.add('has-items');
            } else {
                icon.classList.remove('has-items');
            }
        });
    }

    // Обновление UI пользователя
    updateUserUI() {
        if (!this.state.user) return;
        
        // Обновляем приветствие
        document.querySelectorAll('.user-greeting').forEach(element => {
            element.textContent = `Добро пожаловать, ${this.state.user.first_name}!`;
        });
        
        // Обновляем имя пользователя
        document.querySelectorAll('.user-name').forEach(element => {
            element.textContent = `${this.state.user.first_name} ${this.state.user.last_name}`;
        });
        
        // Обновляем аватар
        document.querySelectorAll('.user-avatar').forEach(avatar => {
            if (this.state.user.avatar) {
                avatar.style.backgroundImage = `url(${this.state.user.avatar})`;
            }
        });
    }

    // Обновление UI избранного
    updateWishlistUI() {
        const wishlistCount = this.state.wishlist.length;
        
        document.querySelectorAll('.wishlist-count').forEach(element => {
            element.textContent = wishlistCount;
            element.style.display = wishlistCount > 0 ? 'flex' : 'none';
        });
    }

    // Обновление UI сравнения
    updateCompareUI() {
        const compareCount = this.state.compare.length;
        
        document.querySelectorAll('.compare-count').forEach(element => {
            element.textContent = compareCount;
            element.style.display = compareCount > 0 ? 'flex' : 'none';
        });
    }

    // Обновление отображения валюты
    updateCurrencyDisplay() {
        document.querySelectorAll('[data-currency]').forEach(element => {
            const value = parseFloat(element.dataset.value || element.textContent);
            if (!isNaN(value)) {
                element.textContent = `${value.toFixed(2)} ${this.config.currencySymbol}`;
            }
        });
    }

    // Настройка аналитики
    setupAnalytics() {
        // Отправка события просмотра страницы
        this.trackPageView();
        
        // Отслеживание событий
        this.setupEventTracking();
        
        // Отслеживание производительности
        this.setupPerformanceTracking();
        
        // Отслеживание ошибок
        this.setupErrorTracking();
    }

    // Отслеживание просмотра страницы
    trackPageView() {
        const pageData = {
            url: window.location.href,
            path: window.location.pathname,
            title: document.title,
            referrer: document.referrer,
            timestamp: Date.now(),
            sessionId: this.state.session.id
        };
        
        // Отправляем в аналитику
        this.sendAnalyticsEvent('page_view', pageData);
        
        // Обновляем статистику сессии
        this.state.session.pageViews++;
    }

    // Отслеживание событий
    setupEventTracking() {
        // Автоматическое отслеживание кликов по кнопкам
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button, .btn, [role="button"]');
            if (button) {
                this.trackEvent('button', 'click', {
                    text: button.textContent.trim(),
                    id: button.id,
                    class: button.className,
                    href: button.getAttribute('href')
                });
            }
        });
    }

    // Отправка события в аналитику
    sendAnalyticsEvent(eventName, data) {
        // Формируем полные данные события
        const eventData = {
            event: eventName,
            timestamp: Date.now(),
            session: this.state.session,
            user: this.state.user ? {
                id: this.state.user.id,
                email: this.state.user.email,
                segment: this.state.user.segment
            } : null,
            page: {
                url: window.location.href,
                title: document.title,
                referrer: document.referrer
            },
            device: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                screen: {
                    width: window.screen.width,
                    height: window.screen.height
                },
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            },
            data: data
        };
        
        // Отправляем на сервер (режим разработки - логируем)
        if (this.config.debug) {
            console.log('Analytics Event:', eventData);
        }
        
        // Отправляем на сервер аналитики
        fetch(`${this.config.apiBase}/analytics/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        }).catch(error => {
            console.error('Ошибка отправки аналитики:', error);
        });
    }

    // Отслеживание производительности
    setupPerformanceTracking() {
        if ('PerformanceObserver' in window) {
            // Отслеживание Largest Contentful Paint
            const lcpObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                const lastEntry = entries[entries.length - 1];
                
                this.trackPerformance('LCP', lastEntry.startTime);
            });
            
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            
            // Отслеживание First Input Delay
            const fidObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                entries.forEach(entry => {
                    this.trackPerformance('FID', entry.processingStart - entry.startTime);
                });
            });
            
            fidObserver.observe({ entryTypes: ['first-input'] });
            
            // Отслеживание Cumulative Layout Shift
            let clsValue = 0;
            const clsObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                entries.forEach(entry => {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                    }
                });
                
                this.trackPerformance('CLS', clsValue);
            });
            
            clsObserver.observe({ entryTypes: ['layout-shift'] });
        }
    }

    // Отслеживание ошибок
    setupErrorTracking() {
        // Отслеживание JavaScript ошибок
        window.addEventListener('error', (e) => {
            this.trackError('JavaScript Error', {
                message: e.message,
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno,
                stack: e.error?.stack
            });
        });
        
        // Отслеживание Promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            this.trackError('Unhandled Promise Rejection', {
                reason: e.reason?.toString(),
                stack: e.reason?.stack
            });
        });
        
        // Отслеживание ошибок загрузки ресурсов
        window.addEventListener('error', (e) => {
            if (e.target && e.target.tagName) {
                const tagName = e.target.tagName.toLowerCase();
                if (['img', 'script', 'link', 'iframe'].includes(tagName)) {
                    this.trackError('Resource Load Error', {
                        tag: tagName,
                        src: e.target.src || e.target.href,
                        alt: e.target.alt || 'N/A'
                    });
                }
            }
        }, true);
    }

    // Настройка Service Worker
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('ServiceWorker зарегистрирован:', registration);
                        this.dispatchEvent('serviceWorker:registered', { registration });
                    })
                    .catch(error => {
                        console.error('Ошибка регистрации ServiceWorker:', error);
                    });
            });
            
            // Обработка обновлений Service Worker
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        }
    }

    // Запуск периодических задач
    startPeriodicTasks() {
        // Обновление времени сессии каждую минуту
        setInterval(() => {
            this.state.session.duration = Date.now() - this.state.session.startTime;
        }, 60000);
        
        // Автосохранение каждые 30 секунд
        setInterval(() => {
            this.autoSave();
        }, 30000);
        
        // Проверка новых уведомлений каждую минуту
        if (this.state.user) {
            setInterval(() => {
                this.checkForNotifications();
            }, 60000);
        }
        
        // Синхронизация данных каждые 2 минуты
        setInterval(() => {
            this.syncData();
        }, 120000);
    }

    // Автосохранение
    autoSave() {
        const saveData = {
            cart: this.modules.cart ? this.modules.cart.getCartItems() : [],
            preferences: this.state.preferences,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem('autosave', JSON.stringify(saveData));
        } catch (error) {
            console.error('Ошибка автосохранения:', error);
        }
    }

    // Проверка новых уведомлений
    async checkForNotifications() {
        try {
            const response = await fetch(`${this.config.apiBase}/notifications/unread`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const notifications = await response.json();
                if (notifications.length > 0) {
                    this.showNewNotifications(notifications);
                }
            }
        } catch (error) {
            // Игнорируем ошибки при проверке уведомлений
        }
    }

    // Синхронизация данных
    async syncData() {
        // Синхронизируем корзину
        if (this.modules.cart && this.modules.cart.syncWithServer) {
            await this.modules.cart.syncWithServer();
        }
        
        // Синхронизируем избранное
        await this.syncWishlist();
        
        // Синхронизируем список сравнения
        await this.syncCompareList();
    }

    // Синхронизация оффлайн данных
    async syncOfflineData() {
        const offlineActions = JSON.parse(localStorage.getItem('offline_actions') || '[]');
        
        if (offlineActions.length > 0) {
            this.showNotification('Синхронизация оффлайн данных...', 'info');
            
            for (const action of offlineActions) {
                try {
                    await fetch(action.url, action.options);
                } catch (error) {
                    console.error('Ошибка синхронизации:', error);
                }
            }
            
            localStorage.removeItem('offline_actions');
            this.showNotification('Синхронизация завершена', 'success');
        }
    }

    // Показать новые уведомления
    showNewNotifications(notifications) {
        notifications.forEach(notification => {
            this.showNotification(notification.message, notification.type || 'info');
        });
        
        // Обновляем счетчик уведомлений
        const notificationCount = document.querySelector('.notification-count');
        if (notificationCount) {
            const currentCount = parseInt(notificationCount.textContent) || 0;
            notificationCount.textContent = currentCount + notifications.length;
            notificationCount.style.display = 'flex';
        }
    }

    // Показать уведомление
    showNotification(message, type = 'info') {
        // Используем модуль уведомлений если доступен
        if (this.modules.notifications) {
            this.modules.notifications.show(message, type);
        } else {
            // Базовая реализация
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.innerHTML = `
                <div class="notification-content">
                    <i class="${this.getNotificationIcon(type)}"></i>
                    <span>${message}</span>
                    <button class="notification-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // Анимация появления
            setTimeout(() => notification.classList.add('show'), 10);
            
            // Автоматическое скрытие
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 5000);
            
            // Закрытие по клику
            notification.querySelector('.notification-close').addEventListener('click', () => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            });
        }
    }

    // Получение иконки для уведомления
    getNotificationIcon(type) {
        const icons = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    // Диспатч событий
    dispatchEvent(eventName, data = {}) {
        const event = new CustomEvent(eventName, {
            detail: {
                app: this,
                timestamp: Date.now(),
                ...data
            }
        });
        
        document.dispatchEvent(event);
        
        // Логирование в debug режиме
        if (this.config.debug) {
            console.log(`Event: ${eventName}`, data);
        }
    }

    // Генерация ID сессии
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Проверка типа страницы
    isCatalogPage() {
        return document.querySelector('.catalog-page') !== null ||
               window.location.pathname.includes('/catalog');
    }

    // Фокус на поиск
    focusSearch() {
        const searchInput = document.querySelector('.search-input, input[type="search"]');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    // Сохранение состояния страницы
    savePageState() {
        const state = {
            scrollPosition: window.pageYOffset,
            activeModals: Array.from(document.querySelectorAll('.modal.active')).map(m => m.id),
            activeDropdowns: Array.from(document.querySelectorAll('.dropdown.active')).map(d => d.id),
            formData: this.collectFormData()
        };
        
        sessionStorage.setItem('pageState', JSON.stringify(state));
        this.showNotification('Состояние страницы сохранено', 'info');
    }

    // Восстановление состояния страницы
    restorePageState() {
        const savedState = sessionStorage.getItem('pageState');
        if (savedState) {
            const state = JSON.parse(savedState);
            
            // Восстанавливаем позицию прокрутки
            window.scrollTo(0, state.scrollPosition || 0);
            
            // Восстанавливаем модальные окна
            state.activeModals.forEach(modalId => this.openModal(modalId));
            
            this.showNotification('Состояние страницы восстановлено', 'info');
        }
    }

    // Сбор данных форм
    collectFormData() {
        const formData = {};
        document.querySelectorAll('form').forEach(form => {
            const data = new FormData(form);
            const formObject = {};
            for (let [key, value] of data.entries()) {
                formObject[key] = value;
            }
            formData[form.id || 'form_' + Date.now()] = formObject;
        });
        return formData;
    }

    // Утилиты

    // Форматирование цены
    formatPrice(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: this.config.currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    // Форматирование даты
    formatDate(date, format = 'long') {
        const dateObj = new Date(date);
        const options = {
            year: 'numeric',
            month: format === 'short' ? 'short' : 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        return dateObj.toLocaleDateString('ru-RU', options);
    }

    // Дебаунс функция
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Троттлинг функция
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Проверка поддержки WebP
    supportsWebP() {
        return new Promise((resolve) => {
            const image = new Image();
            image.onload = image.onerror = () => {
                resolve(image.height === 2);
            };
            image.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        });
    }

    // Копирование в буфер обмена
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Скопировано в буфер обмена', 'success');
            return true;
        } catch (error) {
            console.error('Ошибка копирования:', error);
            
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            this.showNotification('Скопировано в буфер обмена', 'success');
            return true;
        }
    }

    // Сохранение изображения
    async saveImage(url, filename) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || 'image.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(blobUrl);
            this.showNotification('Изображение сохранено', 'success');
        } catch (error) {
            console.error('Ошибка сохранения изображения:', error);
            this.showNotification('Ошибка сохранения изображения', 'error');
        }
    }

    // Получение параметров URL
    getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    }

    // Установка параметров URL
    setUrlParams(params) {
        const url = new URL(window.location);
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });
        window.history.pushState({}, '', url);
    }

    // Показать индикатор загрузки
    showLoading(message = 'Загрузка...') {
        let loader = document.getElementById('global-loader');
        
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'global-loader';
            loader.className = 'global-loader';
            loader.innerHTML = `
                <div class="loader-content">
                    <div class="loader-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <div class="loader-text">${message}</div>
                </div>
            `;
            document.body.appendChild(loader);
        }
        
        loader.classList.add('active');
    }

    // Скрыть индикатор загрузки
    hideLoading() {
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.classList.remove('active');
        }
    }

    // Валидация email
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Валидация телефона
    validatePhone(phone) {
        const re = /^[\+]?[78][-\s]?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2}$/;
        return re.test(phone);
    }

    // Проверка сильного пароля
    isStrongPassword(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        return password.length >= minLength && 
               hasUpperCase && 
               hasLowerCase && 
               hasNumbers && 
               hasSpecialChar;
    }

    // Генерация случайного цвета
    generateRandomColor() {
        return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    }

    // Получение контрастного цвета
    getContrastColor(hexColor) {
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    }

    // Анимация элемента
    animateElement(element, animation, duration = 300) {
        element.style.animation = `${animation} ${duration}ms ease`;
        
        setTimeout(() => {
            element.style.animation = '';
        }, duration);
    }

    // Плавная прокрутка к элементу
    smoothScrollTo(element, offset = 0) {
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }

    // Отправка метрики времени загрузки
    sendLoadTimeMetric() {
        if (window.performance && window.performance.timing) {
            const timing = window.performance.timing;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            
            this.sendAnalyticsEvent('page_load_time', {
                loadTime: loadTime,
                domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
                ttfb: timing.responseStart - timing.requestStart
            });
        }
    }

    // Очистка кэша
    clearCache() {
        try {
            localStorage.clear();
            sessionStorage.clear();
            
            // Очищаем кэш Service Worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    registrations.forEach(registration => {
                        registration.unregister();
                    });
                });
            }
            
            this.showNotification('Кэш очищен', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            console.error('Ошибка очистки кэша:', error);
            this.showNotification('Ошибка очистки кэша', 'error');
        }
    }

    // Экспорт данных
    exportData(type = 'all') {
        const data = {
            app: 'VOGUE ÉLITE',
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            data: {}
        };
        
        switch(type) {
            case 'cart':
                data.data.cart = this.modules.cart ? this.modules.cart.getCartItems() : [];
                break;
            case 'wishlist':
                data.data.wishlist = this.state.wishlist;
                break;
            case 'preferences':
                data.data.preferences = this.state.preferences;
                break;
            case 'all':
                data.data = {
                    cart: this.modules.cart ? this.modules.cart.getCartItems() : [],
                    wishlist: this.state.wishlist,
                    compare: this.state.compare,
                    preferences: this.state.preferences,
                    session: this.state.session
                };
                break;
        }
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `vogue-elite-${type}-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        this.showNotification('Данные экспортированы', 'success');
    }

    // Импорт данных
    importData(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.app !== 'VOGUE ÉLITE') {
                    throw new Error('Неверный формат файла');
                }
                
                // Импортируем данные
                if (data.data.cart && this.modules.cart) {
                    // Обработка импорта корзины
                }
                
                if (data.data.wishlist) {
                    this.state.wishlist = data.data.wishlist;
                    this.updateWishlistUI();
                }
                
                if (data.data.preferences) {
                    this.state.preferences = data.data.preferences;
                    this.applyUserPreferences();
                }
                
                this.showNotification('Данные импортированы', 'success');
            } catch (error) {
                console.error('Ошибка импорта:', error);
                this.showNotification('Ошибка импорта данных', 'error');
            }
        };
        
        reader.readAsText(file);
    }

    // Глобальный обработчик ошибок
    setupGlobalErrorHandler() {
        window.onerror = (message, source, lineno, colno, error) => {
            this.trackError('Global Error', {
                message,
                source,
                lineno,
                colno,
                stack: error?.stack
            });
            
            // Показываем пользователю дружелюбное сообщение
            if (!this.config.debug) {
                this.showNotification('Произошла ошибка. Попробуйте обновить страницу.', 'error');
            }
            
            return false;
        };
    }

    // Завершение работы приложения
    destroy() {
        // Сохраняем данные
        this.autoSave();
        
        // Очищаем интервалы
        this.clearAllIntervals();
        
        // Удаляем обработчики событий
        this.removeEventListeners();
        
        // Отправляем событие завершения
        this.dispatchEvent('app:destroyed');
        
        console.log('VOGUE ÉLITE приложение завершено');
    }
}

// Вспомогательные классы

class NotificationManager {
    constructor() {
        this.container = null;
        this.queue = [];
        this.setup();
    }
    
    setup() {
        this.createContainer();
    }
    
    createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'notifications-container';
        document.body.appendChild(this.container);
    }
    
    show(message, type = 'info', duration = 5000) {
        const notification = this.createNotification(message, type);
        this.container.appendChild(notification);
        
        // Анимация появления
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Автоматическое скрытие
        if (duration > 0) {
            setTimeout(() => this.hide(notification), duration);
        }
        
        return notification;
    }
    
    createNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="${this.getIcon(type)}"></i>
            </div>
            <div class="notification-content">${message}</div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.hide(notification);
        });
        
        return notification;
    }
    
    hide(notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }
    
    getIcon(type) {
        const icons = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }
}

class UIManager {
    constructor() {
        this.components = new Map();
    }
    
    registerComponent(name, component) {
        this.components.set(name, component);
    }
    
    getComponent(name) {
        return this.components.get(name);
    }
    
    updateComponent(name, data) {
        const component = this.components.get(name);
        if (component && component.update) {
            component.update(data);
        }
    }
}

class AuthManager {
    constructor() {
        this.isAuthenticated = false;
        this.user = null;
    }
    
    async login(credentials) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });
            
            if (response.ok) {
                const data = await response.json();
                this.isAuthenticated = true;
                this.user = data.user;
                return { success: true, data };
            } else {
                return { success: false, error: 'Ошибка авторизации' };
            }
        } catch (error) {
            return { success: false, error: 'Ошибка сети' };
        }
    }
    
    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST'
            });
            
            this.isAuthenticated = false;
            this.user = null;
            return { success: true };
        } catch (error) {
            return { success: false, error: 'Ошибка сети' };
        }
    }
    
    checkAuth() {
        return this.isAuthenticated;
    }
}

class AnalyticsManager {
    constructor() {
        this.events = [];
        this.isEnabled = true;
    }
    
    track(event, data) {
        if (!this.isEnabled) return;
        
        const eventData = {
            event,
            timestamp: Date.now(),
            data,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        this.events.push(eventData);
        this.sendToServer(eventData);
    }
    
    async sendToServer(eventData) {
        try {
            await fetch('/api/analytics/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });
        } catch (error) {
            // Сохраняем для отправки позже
            this.saveForLater(eventData);
        }
    }
    
    saveForLater(eventData) {
        const pending = JSON.parse(localStorage.getItem('analytics_pending') || '[]');
        pending.push(eventData);
        localStorage.setItem('analytics_pending', JSON.stringify(pending));
    }
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Создаем глобальный объект приложения
    window.VogueElite = new VogueEliteApp();
    
    // Экспортируем для использования в других модулях
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = window.VogueElite;
    }
    
    console.log('🎉 VOGUE ÉLITE приложение готово!');
});

// Обработка завершения работы
window.addEventListener('beforeunload', () => {
    if (window.VogueElite) {
        window.VogueElite.destroy();
    }
});

// Экспорт классов для использования в других файлах
export { VogueEliteApp, NotificationManager, UIManager, AuthManager, AnalyticsManager };