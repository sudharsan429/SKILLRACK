from flask import Blueprint, request, jsonify
from database import db_session
from models import Profile, User, Student, Faculty
from services.authentication import login_required, get_current_user

profile_bp = Blueprint('profile', __name__)

@profile_bp.route('/api/profile', methods=['GET'])
@login_required
def get_profile():
    s = db_session()
    user = get_current_user()
    profile = s.query(Profile).filter_by(user_id=user.id).first()

    default_roll = {
        'student': 'STU101',
        'faculty': 'FAC101',
        'admin': 'ADM001',
        'super': 'SUP001'
    }.get(user.role, 'STU101')

    if not profile:
        # Create default profile if not yet created with role-based defaults
        profile = Profile(
            user_id=user.id,
            full_name=user.name,
            email=user.email,
            roll_number=(user.roll_number or default_roll)[:14],
            department='Computer Science and Engineering' if user.role == 'student' else 'Information Technology',
            batch='2024 - 2028 · Section A' if user.role == 'student' else f"{user.role.capitalize()} Department",
            college='Inovate Institute of Technology',
            bio=f'Passionate {user.role.capitalize()} at Inovate Institute of Technology.'
        )
        s.add(profile)
        s.commit()
    elif not profile.roll_number:
        profile.roll_number = (user.roll_number or default_roll)[:14]
        s.commit()

    return jsonify({
        'success': True,
        'profile': profile.to_dict(),
        'role': user.role
    })


@profile_bp.route('/api/profile', methods=['PUT'])
@login_required
def update_profile():
    data = request.get_json(silent=True) or {}
    s = db_session()
    user = get_current_user()

    profile = s.query(Profile).filter_by(user_id=user.id).first()
    if not profile:
        profile = Profile(user_id=user.id, full_name=user.name, email=user.email)
        s.add(profile)

    if 'full_name' in data and data['full_name'].strip():
        profile.full_name = data['full_name'].strip()
        # Also update User.name
        db_user = s.query(User).filter_by(id=user.id).first()
        if db_user:
            db_user.name = profile.full_name
        # And student/faculty record if present
        if user.role == 'student':
            st = s.query(Student).filter_by(user_id=user.id).first()
            if st:
                st.name = profile.full_name
        elif user.role == 'faculty':
            fac = s.query(Faculty).filter_by(user_id=user.id).first()
            if fac:
                fac.name = profile.full_name

    if 'roll_number' in data:
        r_num = data['roll_number'].strip()
        # Enforce max 14 characters/numbers
        if len(r_num) > 14:
            return jsonify({'success': False, 'error': 'Roll number / Institutional ID cannot exceed 14 characters/numbers.'}), 400
        profile.roll_number = r_num
        db_user = s.query(User).filter_by(id=user.id).first()
        if db_user:
            db_user.roll_number = r_num
        if user.role == 'student':
            st = s.query(Student).filter_by(user_id=user.id).first()
            if st:
                st.student_code = r_num
        elif user.role == 'faculty':
            fac = s.query(Faculty).filter_by(user_id=user.id).first()
            if fac:
                fac.faculty_code = r_num

    if 'department' in data:
        profile.department = data['department'].strip()
    if 'batch' in data:
        profile.batch = data['batch'].strip()
    if 'college' in data:
        profile.college = data['college'].strip()
    if 'bio' in data:
        profile.bio = data['bio'].strip()

    try:
        s.commit()
        return jsonify({
            'success': True,
            'message': 'Profile updated successfully.',
            'profile': profile.to_dict()
        })
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
