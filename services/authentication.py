from functools import wraps
from flask import session, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash
from database import db_session
from models import User, Student, Faculty

def authenticate_user(identifier, password):
    s = db_session()
    identifier = identifier.strip().lower()
    
    # Check by email or roll_number
    user = s.query(User).filter(
        (User.email.ilike(identifier)) | (User.roll_number.ilike(identifier))
    ).first()

    if user and user.is_active and check_password_hash(user.password_hash, password):
        return user
    return None

def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    s = db_session()
    return s.query(User).filter_by(id=user_id, is_active=True).first()

def login_user(user):
    session['user_id'] = user.id
    session.permanent = True

def logout_user():
    session.pop('user_id', None)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'Authentication required. Please log in.'}), 401
        return f(*args, **kwargs)
    return decorated_function

def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'success': False, 'error': 'Authentication required. Please log in.'}), 401
            if user.role not in allowed_roles:
                return jsonify({'success': False, 'error': f"Access forbidden for role '{user.role}'."}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator
