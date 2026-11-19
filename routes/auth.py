from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash
from database import db_session
from models import User, Student, Faculty, Profile, UserSetting, Leaderboard
from services.authentication import (
    authenticate_user, login_user, logout_user, get_current_user, login_required
)

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    role = data.get('role', 'student').strip().lower()
    department = data.get('department', 'CSE').strip()
    batch = data.get('batch', '2024-A').strip()
    college = data.get('college', 'ABC Engineering College').strip()
    roll_number = data.get('roll_number', '').strip()

    if not name or not email or not password:
        return jsonify({'success': False, 'error': 'Name, email, and password are required.'}), 400

    if role not in ['student', 'faculty', 'admin', 'super']:
        return jsonify({'success': False, 'error': 'Invalid role specified. Must be student, faculty, admin, or super.'}), 400

    if len(password) < 4:
        return jsonify({'success': False, 'error': 'Password must be at least 4 characters long.'}), 400

    s = db_session()

    # Check for existing email
    if s.query(User).filter_by(email=email).first():
        return jsonify({'success': False, 'error': 'An account with this email already exists.'}), 409

    # Generate or validate roll number/identifier
    if not roll_number:
        if role == 'student':
            count = s.query(Student).count() + 101
            roll_number = f"STU{count}"
        elif role == 'faculty':
            count = s.query(Faculty).count() + 101
            roll_number = f"FAC{count}"
        elif role == 'admin':
            count = s.query(User).filter_by(role='admin').count() + 1
            roll_number = f"ADM{count:03d}"
        else:
            count = s.query(User).filter_by(role='super').count() + 1
            roll_number = f"SUP{count:03d}"
    else:
        if s.query(User).filter_by(roll_number=roll_number).first():
            return jsonify({'success': False, 'error': f"Identifier '{roll_number}' is already registered."}), 409

    try:
        user = User(
            email=email,
            roll_number=roll_number,
            password_hash=generate_password_hash(password),
            role=role,
            name=name
        )
        s.add(user)
        s.flush()

        # Role-specific records
        if role == 'student':
            student = Student(
                user_id=user.id,
                student_code=roll_number,
                name=name,
                email=email,
                department=department,
                batch=batch,
                details=f"{department} · {batch}",
                score='100%',
                status='Active',
                points=100,
                solved_count=0,
                streak_days=1
            )
            s.add(student)
            s.flush()

            lb = Leaderboard(
                student_id=student.id,
                rank=s.query(Leaderboard).count() + 1,
                points=100,
                solved_count=0,
                streak_days=1
            )
            s.add(lb)

        elif role == 'faculty':
            faculty = Faculty(
                user_id=user.id,
                faculty_code=roll_number,
                name=name,
                email=email,
                department=department,
                details=f"{department} · Faculty",
                status='Active'
            )
            s.add(faculty)

        # Profile and Settings
        profile = Profile(
            user_id=user.id,
            full_name=name,
            email=email,
            roll_number=roll_number,
            department=department,
            batch=batch if role == 'student' else f"{department} Department",
            college=college,
            bio=f"Passionate {role.capitalize()} at {college}."
        )
        setting = UserSetting(user_id=user.id, theme='light')
        s.add_all([profile, setting])
        s.commit()

        # Log in newly registered user immediately
        login_user(user)

        user_info = {
            'id': user.id,
            'email': user.email,
            'roll_number': user.roll_number,
            'name': user.name,
            'role': user.role
        }

        return jsonify({
            'success': True,
            'message': f"Account registered successfully! Welcome, {user.name} ({role.capitalize()}).",
            'user': user_info
        }), 201

    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    identifier = data.get('identifier', '').strip()
    password = data.get('password', '').strip()

    if not identifier or not password:
        return jsonify({'success': False, 'error': 'Please provide both email/roll number and password.'}), 400

    user = authenticate_user(identifier, password)
    if not user:
        return jsonify({'success': False, 'error': 'Invalid email/roll number or password.'}), 401

    login_user(user)

    # Fetch user details
    user_info = {
        'id': user.id,
        'email': user.email,
        'roll_number': user.roll_number,
        'name': user.name,
        'role': user.role
    }

    return jsonify({
        'success': True,
        'message': f"Welcome back, {user.name}!",
        'user': user_info
    })

@auth_bp.route('/api/logout', methods=['POST'])
def logout():
    logout_user()
    return jsonify({'success': True, 'message': 'Signed out successfully.'})

@auth_bp.route('/api/session', methods=['GET'])
def get_session():
    user = get_current_user()
    if not user:
        return jsonify({'authenticated': False})

    # Fetch user settings for theme
    s = db_session()
    setting = s.query(UserSetting).filter_by(user_id=user.id).first()
    theme = setting.theme if setting else 'light'

    return jsonify({
        'authenticated': True,
        'user': {
            'id': user.id,
            'email': user.email,
            'roll_number': user.roll_number,
            'name': user.name,
            'role': user.role,
            'theme': theme
        }
    })
