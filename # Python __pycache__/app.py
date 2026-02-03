from flask import Flask, render_template, jsonify, request, session, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, current_user, logout_user
from datetime import datetime
import os
import json
import logging
from config import config, Categories, Emoji

# Настройка логгирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('VogueEliteWeb')

app = Flask(__name__)
app.config.from_object(config)

# Настройка базы данных
db = SQLAlchemy(app)

# Настройка Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Модели базы данных
class User(db.Model, UserMixin):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    telegram_id = db.Column(db.Integer, unique=True)
    username = db.Column(db.String(100))
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    is_admin = db.Column(db.Boolean, default=False)
    is_vip = db.Column(db.Boolean, default=False)
    total_orders = db.Column(db.Integer, default=0)
    total_spent = db.Column(db.Float, default=0.0)
    referral_code = db.Column(db.String(50), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_activity = db.Column(db.DateTime, default=datetime.utcnow)

class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    article = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    detailed_description = db.Column(db.Text)
    price = db.Column(db.Float, nullable=False)
    old_price = db.Column(db.Float)
    discount = db.Column(db.Integer, default=0)
    category = db.Column(db.String(100), nullable=False)
    subcategory = db.Column(db.String(100))
    size = db.Column(db.String(100))
    color = db.Column(db.String(100))
    material = db.Column(db.String(200))
    brand = db.Column(db.String(100))
    season = db.Column(db.String(50))
    country = db.Column(db.String(50))
    image_url = db.Column(db.String(500))
    images = db.Column(db.Text)  # JSON строки с изображениями
    is_new = db.Column(db.Boolean, default=False)
    is_hit = db.Column(db.Boolean, default=False)
    is_exclusive = db.Column(db.Boolean, default=False)
    is_limited = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    stock = db.Column(db.Integer, default=0)
    reserved = db.Column(db.Integer, default=0)
    weight = db.Column(db.Float)
    dimensions = db.Column(db.String(100))
    care_instructions = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(50), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(50), default='new')
    total_amount = db.Column(db.Float, nullable=False)
    discount_amount = db.Column(db.Float, default=0.0)
    delivery_cost = db.Column(db.Float, default=0.0)
    final_amount = db.Column(db.Float, nullable=False)
    delivery_address = db.Column(db.Text)
    delivery_type = db.Column(db.String(50), default='courier')
    payment_method = db.Column(db.String(50))
    payment_status = db.Column(db.String(50), default='pending')
    promo_code = db.Column(db.String(50))
    customer_notes = db.Column(db.Text)
    admin_notes = db.Column(db.Text)
    items_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = db.relationship('User', backref=db.backref('orders', lazy=True))

class Cart(db.Model):
    __tablename__ = 'cart'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    selected_size = db.Column(db.String(50))
    selected_color = db.Column(db.String(50))
    price_at_addition = db.Column(db.Float)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship('User', backref=db.backref('cart_items', lazy=True))
    product = db.relationship('Product', backref=db.backref('cart_entries', lazy=True))

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Создаем таблицы при первом запуске
with app.app_context():
    db.create_all()
    
    # Создаем тестовые товары если их нет
    if Product.query.count() == 0:
        test_products = [
            Product(
                article=f"VOGUE{str(i).zfill(3)}",
                name=f"Эксклюзивное платье {i}",
                description=f"Роскошное платье премиум-класса {i}",
                price=25000 + i*5000,
                category=Categories.DRESSES,
                size="XS,S,M,L,XL",
                color="Черный, Белый, Красный",
                material="Шелк, Кружево",
                brand="VOGUE ÉLITE",
                image_url="https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&h=1200&fit=crop&q=80",
                is_new=True if i < 3 else False,
                is_exclusive=True,
                stock=10
            ) for i in range(1, 6)
        ]
        db.session.add_all(test_products)
        db.session.commit()
        logger.info("Созданы тестовые товары")

# Контекстный процессор для передачи данных во все шаблоны
@app.context_processor
def inject_globals():
    return {
        'shop_name': config.SHOP_NAME,
        'shop_slogan': config.SHOP_SLOGAN,
        'shop_phone': config.SHOP_PHONE,
        'shop_email': config.SHOP_EMAIL,
        'support_username': config.SUPPORT_USERNAME,
        'emoji': Emoji,
        'categories': Categories
    }

# Главная страница
@app.route('/')
def index():
    new_products = Product.query.filter_by(is_new=True, is_active=True).limit(8).all()
    hit_products = Product.query.filter_by(is_hit=True, is_active=True).limit(8).all()
    exclusive_products = Product.query.filter_by(is_exclusive=True, is_active=True).limit(8).all()
    
    return render_template('index.html',
                         new_products=new_products,
                         hit_products=hit_products,
                         exclusive_products=exclusive_products)

# Каталог
@app.route('/catalog')
def catalog_page():
    category = request.args.get('category', 'all')
    page = request.args.get('page', 1, type=int)
    per_page = 12
    
    query = Product.query.filter_by(is_active=True)
    
    if category != 'all':
        query = query.filter_by(category=category)
    
    products = query.order_by(Product.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    # Получаем все категории
    categories = db.session.query(Product.category).distinct().all()
    categories = [c[0] for c in categories if c[0]]
    
    return render_template('catalog.html',
                         products=products,
                         categories=categories,
                         current_category=category)

# Страница товара
@app.route('/product/<int:product_id>')
def product_detail(product_id):
    product = Product.query.get_or_404(product_id)
    
    # Аналогичные товары
    similar_products = Product.query.filter(
        Product.category == product.category,
        Product.id != product.id,
        Product.is_active == True
    ).limit(4).all()
    
    return render_template('product.html',
                         product=product,
                         similar_products=similar_products)

# Корзина
@app.route('/cart')
@login_required
def cart_page():
    cart_items = Cart.query.filter_by(user_id=current_user.id).all()
    total = sum(item.product.price * item.quantity for item in cart_items if item.product)
    
    # Расчет доставки
    delivery_cost = 0 if total >= config.FREE_DELIVERY_THRESHOLD else config.DELIVERY_COST
    final_amount = total + delivery_cost
    
    return render_template('cart.html',
                         cart_items=cart_items,
                         total=total,
                         delivery_cost=delivery_cost,
                         final_amount=final_amount,
                         free_delivery_threshold=config.FREE_DELIVERY_THRESHOLD)

# Оформление заказа
@app.route('/checkout')
@login_required
def checkout():
    cart_items = Cart.query.filter_by(user_id=current_user.id).all()
    
    if not cart_items:
        flash('Ваша корзина пуста', 'warning')
        return redirect(url_for('cart_page'))
    
    total = sum(item.product.price * item.quantity for item in cart_items if item.product)
    delivery_cost = 0 if total >= config.FREE_DELIVERY_THRESHOLD else config.DELIVERY_COST
    final_amount = total + delivery_cost
    
    return render_template('checkout.html',
                         cart_items=cart_items,
                         total=total,
                         delivery_cost=delivery_cost,
                         final_amount=final_amount)

# История заказов
@app.route('/orders')
@login_required
def orders():
    user_orders = Order.query.filter_by(user_id=current_user.id)\
        .order_by(Order.created_at.desc()).all()
    
    return render_template('orders.html', orders=user_orders)

# Профиль пользователя
@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html', user=current_user)

# Админ-панель
@app.route('/admin')
@login_required
def admin_panel():
    if not current_user.is_admin:
        flash('Доступ запрещен', 'danger')
        return redirect(url_for('index'))
    
    # Статистика
    total_users = User.query.count()
    total_products = Product.query.filter_by(is_active=True).count()
    total_orders = Order.query.count()
    total_revenue = db.session.query(db.func.sum(Order.final_amount)).scalar() or 0
    
    # Последние заказы
    recent_orders = Order.query.order_by(Order.created_at.desc()).limit(10).all()
    
    # Последние пользователи
    recent_users = User.query.order_by(User.created_at.desc()).limit(10).all()
    
    return render_template('admin.html',
                         total_users=total_users,
                         total_products=total_products,
                         total_orders=total_orders,
                         total_revenue=total_revenue,
                         recent_orders=recent_orders,
                         recent_users=recent_users)

# API для управления товарами
@app.route('/api/products', methods=['GET'])
def api_products():
    products = Product.query.filter_by(is_active=True).all()
    return jsonify([{
        'id': p.id,
        'article': p.article,
        'name': p.name,
        'description': p.description,
        'price': p.price,
        'old_price': p.old_price,
        'discount': p.discount,
        'category': p.category,
        'image_url': p.image_url,
        'stock': p.stock
    } for p in products])

# API для добавления в корзину
@app.route('/api/cart/add', methods=['POST'])
@login_required
def api_add_to_cart():
    data = request.json
    product_id = data.get('product_id')
    quantity = data.get('quantity', 1)
    size = data.get('size')
    color = data.get('color')
    
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'success': False, 'message': 'Товар не найден'}), 404
    
    # Проверяем наличие
    if product.stock < quantity:
        return jsonify({'success': False, 'message': 'Недостаточно товара на складе'}), 400
    
    # Проверяем, есть ли уже в корзине
    existing_item = Cart.query.filter_by(
        user_id=current_user.id,
        product_id=product_id,
        selected_size=size,
        selected_color=color
    ).first()
    
    if existing_item:
        existing_item.quantity += quantity
    else:
        cart_item = Cart(
            user_id=current_user.id,
            product_id=product_id,
            quantity=quantity,
            selected_size=size,
            selected_color=color,
            price_at_addition=product.price
        )
        db.session.add(cart_item)
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Товар добавлен в корзину'})

# API для создания заказа
@app.route('/api/order/create', methods=['POST'])
@login_required
def api_create_order():
    data = request.json
    
    # Получаем товары из корзины
    cart_items = Cart.query.filter_by(user_id=current_user.id).all()
    
    if not cart_items:
        return jsonify({'success': False, 'message': 'Корзина пуста'}), 400
    
    # Проверяем наличие всех товаров
    for item in cart_items:
        if item.product.stock < item.quantity:
            return jsonify({
                'success': False,
                'message': f'Недостаточно товара: {item.product.name}'
            }), 400
    
    # Рассчитываем сумму
    total = sum(item.product.price * item.quantity for item in cart_items)
    delivery_cost = 0 if total >= config.FREE_DELIVERY_THRESHOLD else config.DELIVERY_COST
    final_amount = total + delivery_cost
    
    # Создаем заказ
    order_number = f"ORD{datetime.now().strftime('%Y%m%d')}{current_user.id:04d}{Order.query.count() + 1:04d}"
    
    # Подготавливаем данные товаров
    items_data = []
    for item in cart_items:
        items_data.append({
            'product_id': item.product_id,
            'name': item.product.name,
            'article': item.product.article,
            'price': item.product.price,
            'quantity': item.quantity,
            'size': item.selected_size,
            'color': item.selected_color
        })
        
        # Резервируем товар
        item.product.stock -= item.quantity
        item.product.reserved += item.quantity
    
    order = Order(
        order_number=order_number,
        user_id=current_user.id,
        total_amount=total,
        delivery_cost=delivery_cost,
        final_amount=final_amount,
        delivery_address=data.get('address'),
        delivery_type=data.get('delivery_type', 'courier'),
        payment_method=data.get('payment_method'),
        items_json=json.dumps(items_data, ensure_ascii=False)
    )
    
    # Очищаем корзину
    Cart.query.filter_by(user_id=current_user.id).delete()
    
    # Обновляем статистику пользователя
    current_user.total_orders += 1
    current_user.total_spent += final_amount
    
    db.session.add(order)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'order_number': order_number,
        'message': 'Заказ успешно создан!'
    })

# Авторизация через Telegram
@app.route('/login/telegram')
def login_telegram():
    # Здесь будет логика авторизации через Telegram Web App
    return "Telegram Login"

# Выход
@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

# Обработчик ошибок
@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_server_error(e):
    return render_template('500.html'), 500

# Запуск приложения
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=True)