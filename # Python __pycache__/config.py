# config.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Telegram
    BOT_TOKEN = os.getenv('BOT_TOKEN', '8445063044:AAGwsp4PGsSInBDYfAwVWeOq6FNEgZHqImc')
    ADMIN_IDS = [int(os.getenv('ADMIN_ID', '1217487530'))]
    
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///fashion_store.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Shop
    SHOP_NAME = "VOGUE ÉLITE"
    SHOP_SLOGAN = "Искусство стиля"
    SHOP_PHONE = "+7 (495) 123-45-67"
    SHOP_EMAIL = "info@vogue-elite.ru"
    DELIVERY_COST = 500
    FREE_DELIVERY_THRESHOLD = 20000
    SUPPORT_USERNAME = "@Lexaa_161"
    
    # Web App URL (будет автоматически обновлен на Render)
    @property
    def WEB_APP_URL(self):
        return os.getenv('RENDER_EXTERNAL_URL', 'http://localhost:8080')

class Emoji:
    # ========== ОСНОВНЫЕ ЭМОДЗИ ==========
    LOGO = "✨"
    STAR = "⭐"
    VIP = "👑"
    LOCK = "🔒"
    CHECK = "✅"
    CANCEL = "❌"
    WARNING = "⚠️"
    INFO = "ℹ️"
    USER = "👤"
    MONEY = "💰"
    BOT = "🤖"
    DATABASE = "🗄️"
    GIFT = "🎁"
    ATELIER = "✂️"
    
    # ========== КАТЕГОРИИ ==========
    DRESS = "👗"
    SUIT = "👔"
    BLAZER = "🥼"
    PANTS = "👖"
    SKIRT = "👚"
    OUTERWEAR = "🧥"
    ACCESSORIES = "🧣"
    SHOES = "👠"
    BAG = "👜"
    JEWELRY = "💍"
    
    # ========== ДЕЙСТВИЯ ==========
    CART = "🛍️"
    FAVORITE = "❤️"
    ORDER = "📦"
    DELIVERY = "🚚"
    SIZE = "📏"
    COLOR = "🎨"
    CATEGORY = "🏷️"
    ARTICLE = "🔖"
    VIEW = "👁️"
    
    # ========== СТАТУСЫ ==========
    NEW = "🆕"
    EXCLUSIVE = "💎"
    BESTSELLER = "🔥"
    SALE = "🏷️"
    
    # ========== СЕРВИСЫ ==========
    SUPPORT = "📞"
    WEBSITE = "🌐"
    PHONE = "📱"
    CLOCK = "⏰"
    MESSAGE = "💬"
    LINK = "🔗"
    
    # ========== НАВИГАЦИЯ ==========
    FILTER = "🔍"
    NEXT = "➡️"
    BACK = "⬅️"
    SETTINGS = "⚙️"
    
    # ========== АДМИН ==========
    ADMIN = "🛡️"
    BROADCAST = "📢"
    STATS = "📊"
    USERS = "👥"
    KEYBOARD = "⌨️"

class Categories:
    DRESSES = "Платья"
    SUITS = "Костюмы"
    BLOUSES = "Блузы"
    PANTS = "Брюки"
    SKIRTS = "Юбки"
    JACKETS = "Куртки"
    COATS = "Пальто"
    ACCESSORIES = "Аксессуары"
    SHOES = "Обувь"
    BAGS = "Сумки"
    JEWELRY = "Украшения"

config = Config()