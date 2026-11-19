import io
import csv
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash
from database import db_session
from models import User, Student, Profile, UserSetting, Leaderboard
from services.authentication import get_current_user, login_required, role_required

students_bp = Blueprint('students', __name__)

@students_bp.route('/api/students', methods=['GET'])
@login_required
def get_students():
    s = db_session()
    q = request.args.get('q', '').strip().lower()
    
    query = s.query(Student)
    if q:
        query = query.filter(
            (Student.name.ilike(f"%{q}%")) |
            (Student.student_code.ilike(f"%{q}%")) |
            (Student.department.ilike(f"%{q}%")) |
            (Student.batch.ilike(f"%{q}%"))
        )

    students = query.order_by(Student.id.asc()).all()
    return jsonify({
        'success': True,
        'count': len(students),
        'students': [st.to_dict() for st in students]
    })

@students_bp.route('/api/students', methods=['POST'])
@login_required
@role_required(['faculty', 'admin', 'super'])
def add_student():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    details = data.get('details', '').strip() or 'CSE · A'
    email = data.get('email', '').strip()
    status = data.get('status', 'Active')

    if not name:
        return jsonify({'success': False, 'error': 'Student name is required.'}), 400

    s = db_session()
    
    # Generate student code
    last_id = s.query(Student).count() + 101
    code = f"STU{last_id}"
    while s.query(Student).filter_by(student_code=code).first():
        last_id += 1
        code = f"STU{last_id}"

    if not email:
        clean_name = ''.join(c for c in name.lower() if c.isalnum())
        email = f"{clean_name}{last_id}@demo.com"

    # Check if email exists
    if s.query(User).filter_by(email=email).first():
        email = f"student_{last_id}@demo.com"

    # Parse details e.g. "CSE · A" -> dept: CSE, batch: 2024-A
    parts = [p.strip() for p in details.split('·')]
    dept = parts[0] if len(parts) > 0 else 'CSE'
    sec = parts[1] if len(parts) > 1 else 'A'
    batch_str = f"2024-{sec}"

    user = User(
        email=email,
        roll_number=code,
        password_hash=generate_password_hash('demo123'),
        role='student',
        name=name
    )
    s.add(user)
    s.flush()

    student = Student(
        user_id=user.id,
        student_code=code,
        name=name,
        email=email,
        department=dept,
        batch=batch_str,
        details=details,
        score='80%',
        status=status,
        points=100,
        solved_count=5,
        streak_days=1
    )
    s.add(student)
    s.flush()

    prof = Profile(user_id=user.id, full_name=name, email=email, roll_number=code, department=dept, batch=batch_str)
    sett = UserSetting(user_id=user.id, theme='light')
    lb = Leaderboard(student_id=student.id, rank=s.query(Leaderboard).count() + 1, points=100, solved_count=5)
    s.add_all([prof, sett, lb])

    s.commit()

    return jsonify({
        'success': True,
        'message': f"Student '{name}' added successfully.",
        'student': student.to_dict()
    }), 201

@students_bp.route('/api/students/<int:id>', methods=['GET'])
@login_required
def get_student(id):
    s = db_session()
    student = s.query(Student).filter_by(id=id).first()
    if not student:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404
    return jsonify({'success': True, 'student': student.to_dict()})

@students_bp.route('/api/students/<int:id>', methods=['PUT'])
@login_required
@role_required(['faculty', 'admin', 'super'])
def update_student(id):
    data = request.get_json(silent=True) or {}
    s = db_session()
    student = s.query(Student).filter_by(id=id).first()
    if not student:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404

    name = data.get('name', '').strip()
    details = data.get('details', '').strip()
    score = data.get('score', '').strip()
    status = data.get('status', '').strip()
    department = data.get('department', '').strip()
    batch = data.get('batch', '').strip()

    if name:
        student.name = name
        if student.user:
            student.user.name = name
    if details:
        student.details = details
        parts = [p.strip() for p in details.split('·')]
        if len(parts) > 0:
            student.department = parts[0]
        if len(parts) > 1:
            student.batch = parts[1]
    if score:
        student.score = score
    if status:
        student.status = status
    if department:
        student.department = department
    if batch:
        student.batch = batch

    s.commit()
    return jsonify({
        'success': True,
        'message': 'Student record updated successfully.',
        'student': student.to_dict()
    })

@students_bp.route('/api/students/<int:id>', methods=['DELETE'])
@login_required
@role_required(['faculty', 'admin', 'super'])
def delete_student(id):
    s = db_session()
    student = s.query(Student).filter_by(id=id).first()
    if not student:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404

    user = student.user
    s.delete(student)
    if user:
        s.delete(user)
    s.commit()

    return jsonify({'success': True, 'message': 'Student record deleted successfully.'})

@students_bp.route('/api/students/bulk-import', methods=['POST'])
@login_required
@role_required(['admin', 'super'])
def bulk_import():
    """
    Validates CSV format: roll_number, name, email, department, batch
    Inserts valid records into SQLite.
    """
    content = ""
    if 'file' in request.files:
        f = request.files['file']
        content = f.read().decode('utf-8-sig', errors='replace')
    else:
        data = request.get_json(silent=True) or {}
        content = data.get('csv_data', '') or data.get('content', '')

    if not content.strip():
        return jsonify({'success': False, 'error': 'No CSV content provided.'}), 400

    s = db_session()
    reader = csv.reader(io.StringIO(content))
    imported_count = 0
    errors = []

    rows = list(reader)
    if not rows:
        return jsonify({'success': False, 'error': 'CSV file is empty.'}), 400

    # Check header
    header = [h.strip().lower() for h in rows[0]]
    start_idx = 1 if ('roll_number' in header or 'name' in header or 'email' in header) else 0

    for i, row in enumerate(rows[start_idx:], start=start_idx + 1):
        if not row or not any(row):
            continue
        if len(row) < 3:
            errors.append(f"Row {i}: Missing required columns.")
            continue

        roll = row[0].strip() if len(row) > 0 else f"IMP{i}"
        name = row[1].strip() if len(row) > 1 else ''
        email = row[2].strip() if len(row) > 2 else f"{roll.lower()}@demo.com"
        dept = row[3].strip() if len(row) > 3 else 'CSE'
        batch = row[4].strip() if len(row) > 4 else '2024-A'

        if not name:
            errors.append(f"Row {i}: Name cannot be empty.")
            continue
        if not email or '@' not in email:
            errors.append(f"Row {i}: Invalid email '{email}'.")
            continue

        # Check if user already exists
        existing_user = s.query(User).filter((User.email == email) | (User.roll_number == roll)).first()
        if existing_user:
            errors.append(f"Row {i}: Student with roll '{roll}' or email '{email}' already exists.")
            continue

        # Create user & student
        new_user = User(
            email=email,
            roll_number=roll,
            password_hash=generate_password_hash('demo123'),
            role='student',
            name=name
        )
        s.add(new_user)
        s.flush()

        details = f"{dept} · {batch}"
        new_student = Student(
            user_id=new_user.id,
            student_code=roll,
            name=name,
            email=email,
            department=dept,
            batch=batch,
            details=details,
            score='80%',
            status='Active',
            points=100,
            solved_count=5,
            streak_days=1
        )
        s.add(new_student)
        s.flush()

        prof = Profile(user_id=new_user.id, full_name=name, email=email, roll_number=roll, department=dept, batch=batch)
        sett = UserSetting(user_id=new_user.id, theme='light')
        lb = Leaderboard(student_id=new_student.id, rank=s.query(Leaderboard).count() + 1, points=100, solved_count=5)
        s.add_all([prof, sett, lb])

        imported_count += 1

    s.commit()

    return jsonify({
        'success': True,
        'imported_count': imported_count,
        'errors': errors,
        'message': f"Successfully imported {imported_count} student records."
    })
