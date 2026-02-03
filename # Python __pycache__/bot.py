import telebot
from telebot import types
import json
import logging
from datetime import datetime
import time
import threading
import random
import sqlite3
from config import config, Emoji, Categories
import os
import requests

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger('VogueEliteBot')

class Database:
    """Класс для работы с базой данных SQLite"""
    def __init__(self, db_path='fashion_store.db'):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.init_db()
    
    def init_db(self):
        """Инициализация базы данных"""
        cursor = self.conn.cursor()
        
        # Создаем таблицу пользователей (упрощенная версия)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bot_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT NOT NULL,
                last_name TEXT,
                language_code TEXT DEFAULT 'ru',
                is_admin INTEGER DEFAULT 0,
                is_vip INTEGER DEFAULT 0,
                total_orders INTEGER DEFAULT 0,
                total_spent REAL DEFAULT 0,
                referral_code TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Создаем таблицу для кэша товаров
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bot_products_cache (
                id INTEGER PRIMARY KEY,
                article TEXT UNIQUE,
                name TEXT,
                price REAL,
                category TEXT,
                image_url TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Добавляем администратора
        cursor.execute('''
            INSERT OR IGNORE INTO bot_users 
            (telegram_id, username, first_name, is_admin, is_vip, referral_code)
            VALUES (?, ?, ?, 1, 1, ?)
        ''', (config.ADMIN_IDS[0], 'admin', 'Администратор', 'ADMIN001'))
        
        self.conn.commit()
        logger.info("База данных бота инициализирована")
    
    def register_user(self, telegram_id, username, first_name, last_name=None, language_code='ru'):
        """Регистрация нового пользователя"""
        cursor = self.conn.cursor()
        referral_code = f"VIP{random.randint(10000, 99999)}"
        
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO bot_users 
                (telegram_id, username, first_name, last_name, language_code, referral_code)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (telegram_id, username, first_name, last_name, language_code, referral_code))
            
            if cursor.rowcount > 0:
                logger.info(f"Новый пользователь зарегистрирован: {first_name} (@{username})")
                return True
            else:
                # Обновляем последнюю активность
                cursor.execute('''
                    UPDATE bot_users SET last_activity = CURRENT_TIMESTAMP 
                    WHERE telegram_id = ?
                ''', (telegram_id,))
                return False
                
        except Exception as e:
            logger.error(f"Ошибка регистрации пользователя: {e}")
            return False
        finally:
            self.conn.commit()
    
    def update_product_cache(self, products):
        """Обновление кэша товаров из веб-приложения"""
        cursor = self.conn.cursor()
        
        for product in products:
            cursor.execute('''
                INSERT OR REPLACE INTO bot_products_cache 
                (id, article, name, price, category, image_url)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                product.get('id'),
                product.get('article'),
                product.get('name'),
                product.get('price'),
                product.get('category'),
                product.get('image_url')
            ))
        
        self.conn.commit()
        logger.info(f"Кэш товаров обновлен: {len(products)} товаров")
    
    def get_cached_products(self, category=None, limit=10):
        """Получение товаров из кэша"""
        cursor = self.conn.cursor()
        
        if category:
            cursor.execute('''
                SELECT * FROM bot_products_cache 
                WHERE category = ? 
                ORDER BY RANDOM() 
                LIMIT ?
            ''', (category, limit))
        else:
            cursor.execute('''
                SELECT * FROM bot_products_cache 
                ORDER BY RANDOM() 
                LIMIT ?
            ''', (limit,))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_user_stats(self, telegram_id):
        """Получение статистики пользователя"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT total_orders, total_spent, is_vip 
            FROM bot_users 
            WHERE telegram_id = ?
        ''', (telegram_id,))
        
        result = cursor.fetchone()
        return dict(result) if result else None
    
    def close(self):
        """Закрытие соединения с БД"""
        self.conn.close()

class VogueEliteBot:
    """Основной класс Telegram бота"""
    
    def __init__(self):
        self.bot = telebot.TeleBot(config.BOT_TOKEN)
        self.db = Database()
        self.web_app_url = config.WEB_APP_URL
        self.user_states = {}  # Для многошаговых операций
        
        print("=" * 70)
        print("✨ VOGUE ÉLITE TELEGRAM BOT")
        print("=" * 70)
        print("🤖 Бот запущен")
        print("🌐 Web App:", self.web_app_url)
        print("🛡️ Admin ID:", config.ADMIN_IDS[0])
        print("🗄️ База данных: fashion_store.db")
        print("=" * 70)
        
        self.setup_handlers()
        self.start_background_tasks()
        
        logger.info("Бот Vogue Élite инициализирован")
    
    def start_background_tasks(self):
        """Запуск фоновых задач"""
        # Загрузка товаров из веб-приложения
        def sync_products():
            while True:
                try:
                    response = requests.get(f"{self.web_app_url}/api/products", timeout=10)
                    if response.status_code == 200:
                        products = response.json().get('products', [])
                        if products:
                            self.db.update_product_cache(products)
                            logger.info(f"Товары синхронизированы: {len(products)} шт.")
                except Exception as e:
                    logger.error(f"Ошибка синхронизации товаров: {e}")
                
                time.sleep(300)  # Синхронизация каждые 5 минут
        
        thread = threading.Thread(target=sync_products, daemon=True)
        thread.start()
        
        # Очистка старых состояний пользователей
        def clean_states():
            while True:
                current_time = time.time()
                to_delete = []
                for user_id, state_data in self.user_states.items():
                    if current_time - state_data.get('timestamp', 0) > 1800:  # 30 минут
                        to_delete.append(user_id)
                
                for user_id in to_delete:
                    del self.user_states[user_id]
                
                time.sleep(60)
        
        thread = threading.Thread(target=clean_states, daemon=True)
        thread.start()
    
    def setup_handlers(self):
        """Настройка обработчиков команд"""
        
        @self.bot.message_handler(commands=['start', 'help'])
        def handle_start(message):
            """Обработка команды /start"""
            self.db.register_user(
                message.from_user.id,
                message.from_user.username,
                message.from_user.first_name,
                message.from_user.last_name,
                message.from_user.language_code
            )
            
            welcome_text = f"""
{Emoji.LOGO} <b>ДОБРО ПОЖАЛОВАТЬ В {config.SHOP_NAME}!</b>

{Emoji.VIP} <b>Здравствуйте, {message.from_user.first_name}!</b>

{config.SHOP_SLOGAN}

{Emoji.STAR} <b>Ваши привилегии:</b>
• {Emoji.EXCLUSIVE} Эксклюзивные коллекции
• {Emoji.CART} Персональный шоппер
• {Emoji.GIFT} Подарочная упаковка
• {Emoji.DELIVERY} Бесплатная доставка от 20.000 ₽
• {Emoji.SUPPORT} Индивидуальный пошив

{Emoji.NEXT} <b>Доступные функции:</b>
{Emoji.DRESS} Каталог коллекций
{Emoji.CART} Корзина с выбором размера
{Emoji.ORDER} История заказов
{Emoji.SUPPORT} Персональный консьерж

{Emoji.WEBSITE} <b>Веб-версия магазина:</b>
{self.web_app_url}

{Emoji.MESSAGE} <b>Поддержка 24/7:</b> {config.SUPPORT_USERNAME}
"""
            
            markup = self.create_main_keyboard(message.chat.id)
            self.bot.send_message(
                message.chat.id,
                welcome_text,
                reply_markup=markup,
                parse_mode='HTML'
            )
        
        @self.bot.message_handler(commands=['menu'])
        def handle_menu(message):
            """Показать меню"""
            markup = self.create_main_keyboard(message.chat.id)
            self.bot.send_message(
                message.chat.id,
                f"{Emoji.SETTINGS} <b>ГЛАВНОЕ МЕНЮ</b>\n\n"
                f"Выберите раздел:",
                reply_markup=markup,
                parse_mode='HTML'
            )
        
        @self.bot.message_handler(commands=['catalog'])
        def handle_catalog(message):
            """Показать каталог"""
            self.show_catalog_categories(message)
        
        @self.bot.message_handler(commands=['cart'])
        def handle_cart(message):
            """Показать корзину"""
            self.show_cart(message)
        
        @self.bot.message_handler(commands=['orders'])
        def handle_orders(message):
            """Показать заказы"""
            self.show_orders(message)
        
        @self.bot.message_handler(commands=['profile'])
        def handle_profile(message):
            """Показать профиль"""
            self.show_profile(message)
        
        @self.bot.message_handler(commands=['support'])
        def handle_support(message):
            """Показать поддержку"""
            self.show_support(message)
        
        @self.bot.message_handler(commands=['discount'])
        def handle_discount(message):
            """Показать скидки"""
            self.show_discounts(message)
        
        @self.bot.message_handler(commands=['web'])
        def handle_web(message):
            """Открыть веб-версию"""
            self.open_web_app(message)
        
        @self.bot.message_handler(commands=['admin'])
        def handle_admin(message):
            """Админ-панель"""
            if message.chat.id not in config.ADMIN_IDS:
                self.bot.send_message(
                    message.chat.id,
                    f"{Emoji.LOCK} <b>Доступ запрещен!</b>\n\n"
                    f"Эта функция доступна только администраторам {config.SHOP_NAME}.",
                    parse_mode='HTML'
                )
                return
            
            self.show_admin_panel(message)
        
        @self.bot.message_handler(commands=['stats'])
        def handle_stats(message):
            """Статистика для админа"""
            if message.chat.id not in config.ADMIN_IDS:
                return
            self.show_stats(message)
        
        @self.bot.message_handler(commands=['broadcast'])
        def handle_broadcast(message):
            """Рассылка для админа"""
            if message.chat.id not in config.ADMIN_IDS:
                return
            self.start_broadcast(message)
        
        # Обработка текстовых сообщений
        @self.bot.message_handler(func=lambda message: True)
        def handle_text(message):
            """Обработка текстовых сообщений"""
            text = message.text
            
            # Проверяем состояния пользователя
            if message.chat.id in self.user_states:
                state = self.user_states[message.chat.id]
                if state.get('action') == 'waiting_broadcast_message':
                    self.process_broadcast_message(message)
                    return
                elif state.get('action') == 'waiting_broadcast_target':
                    self.process_broadcast_target(message)
                    return
            
            # Обработка кнопок меню
            buttons_map = {
                f"{Emoji.DRESS} Каталог": self.show_catalog_categories,
                f"{Emoji.CART} Корзина": self.show_cart,
                f"{Emoji.ORDER} Заказы": self.show_orders,
                f"{Emoji.USER} Профиль": self.show_profile,
                f"{Emoji.SUPPORT} Поддержка": self.show_support,
                f"{Emoji.SALE} Скидки": self.show_discounts,
                f"{Emoji.WEBSITE} Веб-версия": self.open_web_app,
                f"{Emoji.ADMIN} Админ-панель": self.show_admin_panel if message.chat.id in config.ADMIN_IDS else None,
            }
            
            if text in buttons_map:
                handler = buttons_map[text]
                if handler:
                    handler(message)
                else:
                    self.bot.send_message(
                        message.chat.id,
                        f"{Emoji.WARNING} Функция недоступна"
                    )
            else:
                # Если сообщение начинается с @
                if text.startswith('@'):
                    self.handle_user_mention(message)
                else:
                    self.bot.send_message(
                        message.chat.id,
                        f"{Emoji.INFO} <b>Используйте меню для навигации:</b>\n\n"
                        f"Или введите команду:\n"
                        f"/start - Главное меню\n"
                        f"/catalog - Каталог товаров\n"
                        f"/cart - Корзина\n"
                        f"/orders - История заказов\n"
                        f"/web - Веб-версия магазина\n"
                        f"/support - Контакты поддержки",
                        parse_mode='HTML'
                    )
        
        @self.bot.callback_query_handler(func=lambda call: True)
        def handle_callback(call):
            """Обработка callback-запросов"""
            try:
                callback_data = call.data
                
                if callback_data == "show_catalog":
                    self.show_catalog_categories(call.message)
                elif callback_data.startswith("cat_"):
                    category = callback_data[4:]
                    self.show_category_products(call, category)
                elif callback_data.startswith("product_"):
                    product_id = callback_data[8:]
                    self.show_product_detail(call, product_id)
                elif callback_data.startswith("web_catalog_"):
                    category = callback_data[12:]
                    self.open_web_catalog(call.message, category)
                elif callback_data == "web_cart":
                    self.open_web_cart(call.message)
                elif callback_data == "web_orders":
                    self.open_web_orders(call.message)
                elif callback_data == "web_profile":
                    self.open_web_profile(call.message)
                elif callback_data.startswith("admin_"):
                    self.handle_admin_callback(call)
                elif callback_data.startswith("broadcast_"):
                    self.handle_broadcast_callback(call)
                
                self.bot.answer_callback_query(call.id)
                
            except Exception as e:
                logger.error(f"Error handling callback: {e}", exc_info=True)
                self.bot.answer_callback_query(call.id, "Произошла ошибка")
    
    def create_main_keyboard(self, chat_id):
        """Создание основной клавиатуры"""
        markup = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
        
        markup.row(
            types.KeyboardButton(f"{Emoji.DRESS} Каталог"),
            types.KeyboardButton(f"{Emoji.CART} Корзина")
        )
        
        markup.row(
            types.KeyboardButton(f"{Emoji.ORDER} Заказы"),
            types.KeyboardButton(f"{Emoji.USER} Профиль")
        )
        
        markup.row(
            types.KeyboardButton(f"{Emoji.SUPPORT} Поддержка"),
            types.KeyboardButton(f"{Emoji.SALE} Скидки")
        )
        
        markup.row(
            types.KeyboardButton(f"{Emoji.WEBSITE} Веб-версия")
        )
        
        if chat_id in config.ADMIN_IDS:
            markup.row(types.KeyboardButton(f"{Emoji.ADMIN} Админ-панель"))
        
        return markup
    
    def show_catalog_categories(self, message):
        """Показать категории каталога"""
        markup = types.InlineKeyboardMarkup(row_width=2)
        
        categories = [
            (f"{Emoji.DRESS} Платья", Categories.DRESSES),
            (f"{Emoji.SUIT} Костюмы", Categories.SUITS),
            (f"{Emoji.PANTS} Брюки", Categories.PANTS),
            (f"{Emoji.SKIRT} Юбки", Categories.SKIRTS),
            (f"{Emoji.BLAZER} Куртки", Categories.JACKETS),
            (f"{Emoji.OUTERWEAR} Пальто", Categories.COATS),
            (f"{Emoji.SHOES} Обувь", Categories.SHOES),
            (f"{Emoji.BAG} Сумки", Categories.BAGS),
            (f"{Emoji.JEWELRY} Украшения", Categories.JEWELRY),
            (f"{Emoji.ACCESSORIES} Аксессуары", Categories.ACCESSORIES),
        ]
        
        for name, category in categories:
            markup.add(types.InlineKeyboardButton(
                name,
                callback_data=f"cat_{category}"
            ))
        
        # Кнопка для открытия в вебе
        markup.add(types.InlineKeyboardButton(
            f"{Emoji.WEBSITE} Открыть полный каталог",
            web_app=types.WebAppInfo(url=f"{self.web_app_url}/catalog")
        ))
        
        self.bot.send_message(
            message.chat.id,
            f"{Emoji.DRESS} <b>КАТАЛОГ {config.SHOP_NAME}</b>\n\n"
            f"{Emoji.FILTER} Выберите категорию:\n\n"
            f"{Emoji.INFO} Или откройте полную версию каталога в веб-приложении:",
            reply_markup=markup,
            parse_mode='HTML'
        )
    
    def show_category_products(self, call, category):
        """Показать товары категории"""
        products = self.db.get_cached_products(category=category, limit=5)
        
        if not products:
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton(
                f"{Emoji.WEBSITE} Открыть в веб-версии",
                web_app=types.WebAppInfo(url=f"{self.web_app_url}/catalog?category={category}")
            ))
            
            self.bot.send_message(
                call.message.chat.id,
                f"{Emoji.INFO} <b>{category.upper()}</b>\n\n"
                f"Товары этой категории доступны в веб-версии магазина. "
                f"Нажмите кнопку ниже для просмотра:",
                reply_markup=markup,
                parse_mode='HTML'
            )
            return
        
        for product in products:
            product_text = f"""
{Emoji.TAG} <b>{product['name']}</b>

{Emoji.MONEY} <b>Цена:</b> {product['price']:,.0f} ₽
{Emoji.CATEGORY} <b>Категория:</b> {product['category']}
{Emoji.ARTICLE} <b>Артикул:</b> {product['article']}
"""
            
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton(
                f"{Emoji.VIEW} Подробнее в веб-версии",
                web_app=types.WebAppInfo(url=f"{self.web_app_url}/product/{product['id']}")
            ))
            
            try:
                if product.get('image_url'):
                    self.bot.send_photo(
                        call.message.chat.id,
                        product['image_url'],
                        caption=product_text,
                        reply_markup=markup,
                        parse_mode='HTML'
                    )
                else:
                    self.bot.send_message(
                        call.message.chat.id,
                        product_text,
                        reply_markup=markup,
                        parse_mode='HTML'
                    )
            except Exception as e:
                logger.error(f"Error sending product: {e}")
                self.bot.send_message(
                    call.message.chat.id,
                    product_text,
                    reply_markup=markup,
                    parse_mode='HTML'
                )
        
        # Кнопка для открытия всех товаров в вебе
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton(
            f"{Emoji.WEBSITE} Открыть все товары категории",
            web_app=types.WebAppInfo(url=f"{self.web_app_url}/catalog?category={category}")
        ))
        
        self.bot.send_message(
            call.message.chat.id,
            f"{Emoji.INFO} Показано {len(products)} товаров из категории <b>{category}</b>\n"
            f"Для просмотра всех товаров и оформления заказа используйте веб-версию:",
            reply_markup=markup,
            parse_mode='HTML'
        )
    
    def show_product_detail(self, call, product_id):
        """Показать детали товара"""
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton(
            f"{Emoji.VIEW} Открыть в веб-версии",
            web_app=types.WebAppInfo(url=f"{self.web_app_url}/product/{product_id}")
        ))
        
        self.bot.send_message(
            call.message.chat.id,
            f"{Emoji.INFO} <b>ПОДРОБНАЯ ИНФОРМАЦИЯ О ТОВАРЕ</b>\n\n"
            f"Для просмотра полной информации о товаре, выбора размера, цвета "
            f"и добавления в корзину, откройте товар в веб-версии магазина:",
            reply_markup=markup,
            parse_mode='HTML'
        )
    
    def show_cart(self, message):
        """Показать корзину"""
        web_app_button = types.WebAppInfo(url=f"{self.web_app_url}/cart")
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton(
            f"{Emoji.CART} Открыть корзину",
            web_app=web_app_button
        ))
        
        self.bot.send_message(
            message.chat.id,
            f"{Emoji.CART} <b>ВАША КОРЗИНА</b>\n\n"
            f"Нажмите кнопку ниже, чтобы открыть корзину в веб-версии магазина:\n\n"
            f"{Emoji.INFO} В веб-версии вы сможете:\n"
            f"• Просмотреть все товары в корзине\n"
            f"• Изменить количество\n"
            f"• Выбрать размер и цвет\n"
            f"• Оформить заказ\n"
            f"• Применить промокод",
            reply_markup=markup,
            parse_mode='HTML'
        )
    
    def show_orders(self, message):
        """Показать историю заказов"""
        web_app_button = types.WebAppInfo(url=f"{self.web_app_url}/orders")
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton(
            f"{Emoji.ORDER} История заказов",
            web_app=web_app_button
        ))
        
        user_stats = self.db.get_user_stats(message.chat.id)
        
        if user_stats:
            orders_text = f"""
{Emoji.ORDER} <b>ВАША ИСТОРИЯ ЗАКАЗОВ</b>

{Emoji.STATS} <b>Статистика:</b>
{Emoji.CHECK} Всего заказов: {user_stats['total_orders']}
{Emoji.MONEY} Общая сумма: {user_stats['total_spent']:,.0f} ₽
{user_stats['is_vip'] and f"{Emoji.VIP} Статус: VIP клиент" or f"{Emoji.USER} Статус: Стандартный"}

{Emoji.INFO} Для просмотра детальной истории заказов откройте веб-версию:
"""
        else:
            orders_text = f"""
{Emoji.ORDER} <b>ВАША ИСТОРИЯ ЗАКАЗОВ</b>

{Emoji.INFO} У вас пока нет оформленных заказов.
Оформите первый заказ через веб-версию магазина!
"""
        
        self.bot.send_message(
            message.chat.id,
            orders_text,
            reply_markup=markup,
            parse_mode='HTML'
        )
    
    def show_profile(self, message):
        """Показать профиль пользователя"""
        web_app_button = types.WebAppInfo(url=f"{self.web_app_url}/profile")
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton(
            f"{Emoji.USER} Мой профиль",
            web_app=web_app_button
        ))
        
        self.bot.send_message(
            message.chat.id,
            f"{Emoji.USER} <b>ВАШ ПРОФИЛЬ</b>\n\n"
            f"В веб-версии магазина вы можете:\n"
            f"• Просмотреть личную информацию\n"
            f"• Изменить контактные данные\n"
            f"• Посмотреть историю заказов\n"
            f"• Управлять уведомлениями\n"
            f"• Использовать реферальный код\n\n"
            f"{Emoji.INFO} Нажмите кнопку ниже:",
            reply_markup=markup,
            parse_mode='HTML'
        )
    
    def show_support(self, message):
        """Показать информацию о поддержке"""
        support_text = f"""
{Emoji.SUPPORT} <b>СЛУЖБА ПОДДЕРЖКИ {config.SHOP_NAME}</b>

{Emoji.PHONE} <b>Контакты:</b>
Телефон: {config.SHOP_PHONE}
Telegram: {config.SUPPORT_USERNAME}
Email: {config.SHOP_EMAIL}

{Emoji.CLOCK} <b>Часы работы:</b>
Пн-Пт: 10:00-22:00
Сб-Вс: 11:00-20:00

{Emoji.MESSAGE} <b>Услуги поддержки:</b>
• Консультация по товарам
• Помощь с выбором размера
• Статус заказа
• Возврат и обмен
• Индивидуальный пошив

{Emoji.STAR} <b>Персональный консьерж</b>
Каждый клиент {config.SHOP_NAME} получает персонального консьержа, 
который поможет с подбором образа и оформлением заказа.
"""
        
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton(
            f"{Emoji.MESSAGE} Написать в поддержку",
            url=f"https://t.me/{config.SUPPORT_USERNAME.replace('@', '')}"
        ))
        
        self.bot.send_message(
            message.chat.id,
            support_text,
            reply_markup=markup,
            parse_mode='HTML'
        )
    
    def show_discounts(self, message):
        """Показать скидки и акции"""
        discounts_text = f"""
{Emoji.SALE} <b>АКЦИИ И ПРЕДЛОЖЕНИЯ {config.SHOP_NAME}</b>

{Emoji.GIFT} <b>Текущие акции:</b>

• <b>ПРИВЕТСТВЕННАЯ СКИДКА 15%</b>
  Промокод: <code>WELCOME15</code>
  Для новых клиентов

• <b>VIP СКИДКА 25%</b>
  Промокод: <code>VIP25</code>
  При заказе от 15.000 ₽

• <b>ЛЕТНЯЯ КОЛЛЕКЦИЯ -20%</b>
  Промокод: <code>SUMMER2024</code>
  На все товары весенне-летней коллекции

• <b>ПЕРВАЯ ПОКУПКА -10%</b>
  Промокод: <code>FIRSTBUY</code>
  Автоматически при первом заказе

{Emoji.INFO} <b>Как использовать промокод:</b>
1. Откройте веб-версию магазина
2. Добавьте товары в корзину
3. При оформлении заказа введите промокод
4. Скидка применится автоматически

{Emoji.STAR} <b>Особые условия:</b>
• Скидки не суммируются
• Промокод действует 30 дней
• Бесплатная доставка от 20.000 ₽
"""
        
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton(
            f"{Emoji.WEBSITE} Открыть магазин",
            web_app=types.WebAppInfo(url=self.web_app_url)
        ))
        
        self.bot.send_message(
            message.chat.id,
            discounts_text,
            reply_markup=markup,
            parse_mode='HTML'
        )
    
    def open_web_app(self, message):
        """Открыть веб-приложение"""
        web_app_button = types.WebAppInfo(url=self.web_app_url)
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton(
            f"{Emoji.WEBSITE} Открыть Web Boutique",
            web_app=web_app_button
        ))
        
        self.bot.send_message(
            message.chat.id,
            f"{Emoji.WEBSITE} <b>WEB BOUTIQUE {config.SHOP_NAME}</b>\n\n"
            f"Полная версия магазина с удобным интерфейсом:\n\n"
            f"{Emoji.STAR} <b>Доступные функции:</b>\n"
            f"• Полный каталог с фильтрами\n"
            f"• Подробные карточки товаров\n"
            f"• Выбор размера и цвета\n"
            f"• Корзина покупок\n"
            f"• Оформление заказа\n"
            f"• История заказов\n"
            f"• Личный кабинет\n\n"
            f"{Emoji.LINK} <b>Ссылка:</b> {self.web_app_url}",
            reply_markup=markup,
            parse_mode='HTML'
        )
    
    def show_admin_panel(self, message):
        """Показать админ-панель"""
        markup = types.InlineKeyboardMarkup(row_width=2)
        
        markup.add(
            types.InlineKeyboardButton(
                f"{Emoji.WEBSITE} Веб-админка",
                web_app=types.WebAppInfo(url=f"{self.web_app_url}/admin")
            ),
            types.InlineKeyboardButton(
                f"{Emoji.BROADCAST} Рассылка",
                callback_data="broadcast_start"
            )
        )
        
        markup.add(
            types.InlineKeyboardButton(
                f"{Emoji.STATS} Статистика",
                callback_data="admin_stats"
            ),
            types.InlineKeyboardButton(
                f"{Emoji.USERS} Пользователи",
                callback_data="admin_users"
            )
        )
        
        admin_text = f"""
{Emoji.ADMIN} <b>АДМИНИСТРАТИВНАЯ ПАНЕЛЬ</b>

{Emoji.KEYBOARD} <b>Быстрые команды:</b>
<code>/stats</code> - Статистика магазина
<code>/broadcast</code> - Рассылка сообщений
<code>/admin</code> - Эта панель

👇 <b>Управление:</b>
"""
        
        self.bot.send_message(
            message.chat.id,
            admin_text,
            reply_markup=markup,
            parse_mode='HTML'
        )
    
    def show_stats(self, message):
        """Показать статистику"""
        # Здесь можно добавить запрос к API веб-приложения
        stats_text = f"""
{Emoji.STATS} <b>СТАТИСТИКА МАГАЗИНА</b>

{Emoji.INFO} Полная статистика доступна в веб-админке.

{Emoji.WEBSITE} Откройте веб-админку для просмотра:
• Общей статистики
• Аналитики продаж
• Отчетов по дням
• Топ товаров
• Активности пользователей
"""
        
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton(
            f"{Emoji.WEBSITE} Открыть веб-админку",
            web_app=types.WebAppInfo(url=f"{self.web_app_url}/admin")
        ))
        
        self.bot.send_message(
            message.chat.id,
            stats_text,
            reply_markup=markup,
            parse_mode='HTML'
        )
    
    def start_broadcast(self, message):
        """Начать рассылку"""
        self.user_states[message.chat.id] = {
            'action': 'waiting_broadcast_message',
            'timestamp': time.time(),
            'data': {}
        }
        
        self.bot.send_message(
            message.chat.id,
            f"{Emoji.BROADCAST} <b>СОЗДАНИЕ РАССЫЛКИ</b>\n\n"
            f"Отправьте сообщение для рассылки (текст или фото с подписью).\n\n"
            f"{Emoji.INFO} <b>Формат:</b>\n"
            f"• Текст с HTML разметкой\n"
            f"• Фото с подписью\n\n"
            f"{Emoji.CANCEL} Для отмены отправьте /cancel",
            parse_mode='HTML'
        )
    
    def process_broadcast_message(self, message):
        """Обработать сообщение для рассылки"""
        if message.chat.id not in self.user_states:
            return
        
        state = self.user_states[message.chat.id]
        
        if state['action'] != 'waiting_broadcast_message':
            return
        
        broadcast_data = {
            'message_type': 'text',
            'content': '',
            'photo_id': None
        }
        
        if message.text and message.text == '/cancel':
            del self.user_states[message.chat.id]
            self.bot.send_message(message.chat.id, f"{Emoji.CANCEL} Рассылка отменена.")
            return
        
        if message.text:
            broadcast_data['content'] = message.text
            broadcast_data['message_type'] = 'text'
        elif message.photo:
            broadcast_data['photo_id'] = message.photo[-1].file_id
            broadcast_data['content'] = message.caption or ''
            broadcast_data['message_type'] = 'photo'
        else:
            self.bot.send_message(
                message.chat.id,
                f"{Emoji.WARNING} Формат сообщения не поддерживается."
            )
            return
        
        state['data'] = broadcast_data
        state['action'] = 'waiting_broadcast_target'
        state['timestamp'] = time.time()
        
        markup = types.InlineKeyboardMarkup(row_width=2)
        markup.add(
            types.InlineKeyboardButton(f"{Emoji.USERS} Всем", callback_data="broadcast_all"),
            types.InlineKeyboardButton(f"{Emoji.VIP} Только VIP", callback_data="broadcast_vip")
        )
        markup.add(
            types.InlineKeyboardButton(f"{Emoji.CANCEL} Отменить", callback_data="broadcast_cancel"),
            types.InlineKeyboardButton(f"{Emoji.CHECK} Отправить", callback_data="broadcast_send")
        )
        
        preview_text = f"""
{Emoji.BROADCAST} <b>ПРЕДПРОСМОТР РАССЫЛКИ</b>

{Emoji.INFO} <b>Тип:</b> {broadcast_data['message_type'].upper()}
{Emoji.MESSAGE} <b>Содержание:</b>
{broadcast_data['content'][:200]}{'...' if len(broadcast_data['content']) > 200 else ''}

👇 <b>Выберите аудиторию:</b>
"""
        
        if broadcast_data['photo_id']:
            try:
                self.bot.send_photo(
                    message.chat.id,
                    broadcast_data['photo_id'],
                    caption=preview_text,
                    reply_markup=markup,
                    parse_mode='HTML'
                )
            except:
                self.bot.send_message(
                    message.chat.id,
                    preview_text,
                    reply_markup=markup,
                    parse_mode='HTML'
                )
        else:
            self.bot.send_message(
                message.chat.id,
                preview_text,
                reply_markup=markup,
                parse_mode='HTML'
            )
    
    def handle_broadcast_callback(self, call):
        """Обработать callback рассылки"""
        action = call.data.split('_')[1]
        
        if action == 'cancel':
            if call.message.chat.id in self.user_states:
                del self.user_states[call.message.chat.id]
            self.bot.edit_message_text(
                f"{Emoji.CANCEL} Рассылка отменена.",
                call.message.chat.id,
                call.message.message_id
            )
            return
        
        if call.message.chat.id not in self.user_states:
            self.bot.answer_callback_query(call.id, "Сессия истекла")
            return
        
        state = self.user_states[call.message.chat.id]
        broadcast_data = state['data']
        
        # Здесь должна быть логика отправки рассылки
        # В реальном проекте нужно получать пользователей из БД
        
        self.bot.edit_message_text(
            f"{Emoji.CHECK} <b>РАССЫЛКА ОТПРАВЛЕНА</b>\n\n"
            f"Сообщение отправлено выбранной аудитории.\n"
            f"В реальном проекте здесь будет статистика отправки.",
            call.message.chat.id,
            call.message.message_id,
            parse_mode='HTML'
        )
        
        if call.message.chat.id in self.user_states:
            del self.user_states[call.message.chat.id]
    
    def handle_user_mention(self, message):
        """Обработать упоминание пользователя"""
        if message.chat.id not in config.ADMIN_IDS:
            return
        
        mention = message.text[1:]
        self.bot.send_message(
            message.chat.id,
            f"Пользователь @{mention} упомянут.\n"
            f"Для отправки сообщения используйте веб-админку.",
            parse_mode='HTML'
        )
    
    def run_polling(self):
        """Запуск бота в режиме polling"""
        logger.info("Запуск бота в режиме polling...")
        try:
            self.bot.infinity_polling(
                timeout=60,
                long_polling_timeout=60,
                logger_level=logging.ERROR
            )
        except Exception as e:
            logger.error(f"Ошибка запуска бота: {e}")
            time.sleep(5)
            self.run_polling()

# Запуск бота
if __name__ == '__main__':
    bot = VogueEliteBot()
    bot.run_polling()