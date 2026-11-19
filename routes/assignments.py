from flask import Blueprint, request, jsonify
from database import db_session
from models import ProblemAssignment, Problem, Student
from services.authentication import login_required, role_required, get_current_user

assignments_bp = Blueprint('assignments', __name__)

@assignments_bp.route('/api/assignments', methods=['GET'])
@login_required
def get_assignments():
    s = db_session()
    user = get_current_user()
    batch = request.args.get('batch', '').strip()
    status = request.args.get('status', '').strip()

    query = s.query(ProblemAssignment)

    # If student, show assignments for student's batch or 'All Batches'
    if user.role == 'student':
        student = s.query(Student).filter_by(user_id=user.id).first()
        student_batch = student.batch if student else '2024-A'
        query = query.filter(
            (ProblemAssignment.batch_name == student_batch) | 
            (ProblemAssignment.batch_name == 'All Batches') |
            (ProblemAssignment.batch_name == 'CSE-2024-A')
        )
    elif batch and batch.lower() != 'all':
        query = query.filter(ProblemAssignment.batch_name == batch)

    if status and status.lower() != 'all':
        query = query.filter(ProblemAssignment.status.ilike(status))

    assignments = query.order_by(ProblemAssignment.id.desc()).all()
    return jsonify({
        'success': True,
        'count': len(assignments),
        'assignments': [a.to_dict() for a in assignments]
    })


@assignments_bp.route('/api/assignments', methods=['POST'])
@role_required(['faculty', 'admin', 'super'])
def create_assignment():
    data = request.get_json(silent=True) or {}
    problem_id = data.get('problem_id')
    batch_name = data.get('batch_name', '2024-A').strip()
    due_date = data.get('due_date', '').strip()
    instructions = data.get('instructions', '').strip()

    if not problem_id or not due_date:
        return jsonify({'success': False, 'error': 'Problem and Due Date are required.'}), 400

    s = db_session()
    prob = s.query(Problem).filter_by(id=problem_id).first()
    if not prob:
        return jsonify({'success': False, 'error': 'Selected problem not found.'}), 404

    user = get_current_user()
    try:
        assignment = ProblemAssignment(
            problem_id=prob.id,
            assigned_by=user.id,
            batch_name=batch_name,
            due_date=due_date,
            instructions=instructions,
            status='Active'
        )
        s.add(assignment)
        s.commit()
        return jsonify({
            'success': True,
            'message': f"Problem '{prob.title}' assigned to batch '{batch_name}' successfully.",
            'assignment': assignment.to_dict()
        }), 201
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@assignments_bp.route('/api/assignments/<int:assignment_id>', methods=['PUT'])
@role_required(['faculty', 'admin', 'super'])
def update_assignment(assignment_id):
    data = request.get_json(silent=True) or {}
    s = db_session()
    a = s.query(ProblemAssignment).filter_by(id=assignment_id).first()
    if not a:
        return jsonify({'success': False, 'error': 'Assignment not found.'}), 404

    if 'due_date' in data:
        a.due_date = data['due_date'].strip()
    if 'instructions' in data:
        a.instructions = data['instructions'].strip()
    if 'status' in data:
        a.status = data['status'].strip()
    if 'batch_name' in data:
        a.batch_name = data['batch_name'].strip()

    try:
        s.commit()
        return jsonify({
            'success': True,
            'message': 'Assignment updated successfully.',
            'assignment': a.to_dict()
        })
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@assignments_bp.route('/api/assignments/<int:assignment_id>', methods=['DELETE'])
@role_required(['faculty', 'admin', 'super'])
def delete_assignment(assignment_id):
    s = db_session()
    a = s.query(ProblemAssignment).filter_by(id=assignment_id).first()
    if not a:
        return jsonify({'success': False, 'error': 'Assignment not found.'}), 404

    try:
        s.delete(a)
        s.commit()
        return jsonify({'success': True, 'message': 'Assignment deleted successfully.'})
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
