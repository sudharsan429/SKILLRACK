from flask import Blueprint, jsonify
from database import db_session
from services.authentication import get_current_user, login_required
from services.analytics import (
    get_student_dashboard_stats, get_faculty_dashboard_stats,
    get_admin_dashboard_stats, get_super_dashboard_stats
)

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/api/dashboard', methods=['GET'])
@login_required
def dashboard():
    user = get_current_user()
    if user.role == 'student':
        stats = get_student_dashboard_stats(user)
        return jsonify({'success': True, 'role': 'student', 'data': stats})
    elif user.role == 'faculty':
        stats = get_faculty_dashboard_stats()
        return jsonify({'success': True, 'role': 'faculty', 'data': stats})
    elif user.role == 'admin':
        stats = get_admin_dashboard_stats()
        return jsonify({'success': True, 'role': 'admin', 'data': stats})
    elif user.role == 'super':
        stats = get_super_dashboard_stats()
        return jsonify({'success': True, 'role': 'super', 'data': stats})
    else:
        return jsonify({'success': False, 'error': 'Unknown role'}), 400
