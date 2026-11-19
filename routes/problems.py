import json
from flask import Blueprint, request, jsonify
from database import db_session
from models import Problem, Submission, Student, StudentProgress
from services.authentication import login_required, role_required, get_current_user

problems_bp = Blueprint('problems', __name__)

@problems_bp.route('/api/problems', methods=['GET'])
@login_required
def get_problems():
    s = db_session()
    q = request.args.get('q', '').strip().lower()
    difficulty = request.args.get('difficulty', '').strip()
    topic = request.args.get('topic', '').strip()

    query = s.query(Problem)
    if difficulty and difficulty.lower() != 'all':
        query = query.filter(Problem.difficulty.ilike(difficulty))
    if topic and topic.lower() != 'all':
        query = query.filter(Problem.topic.ilike(topic))

    problems = query.order_by(Problem.id.asc()).all()

    if q:
        problems = [
            p for p in problems
            if q in p.title.lower() or q in p.topic.lower() or q in p.difficulty.lower() or q in p.description.lower()
        ]

    # Check solved status for current user
    user = get_current_user()
    solved_titles = set()
    if user:
        solved_titles = {
            sub.problem_title for sub in s.query(Submission.problem_title).filter_by(
                user_id=user.id, verdict='Accepted'
            ).all()
        }

    result = []
    for p in problems:
        d = p.to_dict()
        d['is_solved'] = p.title in solved_titles
        result.append(d)

    return jsonify({
        'success': True,
        'count': len(result),
        'problems': result
    })


@problems_bp.route('/api/problems/<int:problem_id>', methods=['GET'])
@login_required
def get_problem_by_id(problem_id):
    s = db_session()
    p = s.query(Problem).filter_by(id=problem_id).first()
    if not p:
        return jsonify({'success': False, 'error': 'Problem not found.'}), 404

    user = get_current_user()
    is_solved = False
    if user:
        is_solved = s.query(Submission).filter_by(
            user_id=user.id, problem_title=p.title, verdict='Accepted'
        ).first() is not None

    data = p.to_dict()
    data['is_solved'] = is_solved
    return jsonify({'success': True, 'problem': data})


@problems_bp.route('/api/problems', methods=['POST'])
@role_required(['faculty', 'admin', 'super'])
def create_problem():
    data = request.get_json(silent=True) or {}
    title = data.get('title', '').strip()
    difficulty = data.get('difficulty', 'Easy').strip()
    topic = data.get('topic', 'Arrays').strip()
    points = int(data.get('points', 20))
    description = data.get('description', '').strip()
    sample_input = data.get('sample_input', '').strip()
    sample_output = data.get('sample_output', '').strip()
    starter_code_py = data.get('starter_code_py', 'def solve():\n    pass').strip()
    starter_code_java = data.get('starter_code_java', 'class Solution {\n    public void solve() {\n    }\n}').strip()
    starter_code_c = data.get('starter_code_c', '#include <stdio.h>\nint main() {\n    return 0;\n}').strip()
    starter_code_cpp = data.get('starter_code_cpp', '#include <iostream>\nusing namespace std;\nint main() {\n    return 0;\n}').strip()
    starter_code_js = data.get('starter_code_js', 'function solve() {\n}').strip()
    test_cases_json = data.get('test_cases_json', '[]')
    is_daily = bool(data.get('is_daily', False))

    if not title or not description:
        return jsonify({'success': False, 'error': 'Title and Description are required.'}), 400

    s = db_session()
    existing = s.query(Problem).filter_by(title=title).first()
    if existing:
        return jsonify({'success': False, 'error': f"A problem with title '{title}' already exists."}), 409

    if isinstance(test_cases_json, (list, dict)):
        test_cases_json = json.dumps(test_cases_json)

    try:
        prob = Problem(
            title=title,
            difficulty=difficulty,
            topic=topic,
            points=points,
            description=description,
            sample_input=sample_input,
            sample_output=sample_output,
            starter_code_py=starter_code_py,
            starter_code_java=starter_code_java,
            starter_code_c=starter_code_c,
            starter_code_cpp=starter_code_cpp,
            starter_code_js=starter_code_js,
            test_cases_json=test_cases_json,
            is_daily=is_daily
        )
        s.add(prob)
        s.commit()
        return jsonify({
            'success': True,
            'message': f"Problem '{title}' created successfully.",
            'problem': prob.to_dict()
        }), 201
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@problems_bp.route('/api/problems/<int:problem_id>', methods=['PUT'])
@role_required(['faculty', 'admin', 'super'])
def update_problem(problem_id):
    data = request.get_json(silent=True) or {}
    s = db_session()
    p = s.query(Problem).filter_by(id=problem_id).first()
    if not p:
        return jsonify({'success': False, 'error': 'Problem not found.'}), 404

    for key in ['title', 'difficulty', 'topic', 'description', 'sample_input', 'sample_output',
                'starter_code_py', 'starter_code_java', 'starter_code_c', 'starter_code_cpp', 'starter_code_js']:
        if key in data:
            setattr(p, key, data[key])
    if 'points' in data:
        p.points = int(data['points'])
    if 'is_daily' in data:
        p.is_daily = bool(data['is_daily'])
    if 'test_cases_json' in data:
        tc = data['test_cases_json']
        p.test_cases_json = json.dumps(tc) if isinstance(tc, (list, dict)) else str(tc)

    try:
        s.commit()
        return jsonify({
            'success': True,
            'message': f"Problem '{p.title}' updated successfully.",
            'problem': p.to_dict()
        })
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@problems_bp.route('/api/problems/<int:problem_id>', methods=['DELETE'])
@role_required(['admin', 'super'])
def delete_problem(problem_id):
    s = db_session()
    p = s.query(Problem).filter_by(id=problem_id).first()
    if not p:
        return jsonify({'success': False, 'error': 'Problem not found.'}), 404

    title = p.title
    try:
        s.delete(p)
        s.commit()
        return jsonify({'success': True, 'message': f"Problem '{title}' deleted successfully."})
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@problems_bp.route('/api/problems/daily', methods=['GET'])
@login_required
def get_daily_challenge():
    s = db_session()
    prob = s.query(Problem).filter_by(is_daily=True).first()
    if not prob:
        prob = s.query(Problem).first()

    if not prob:
        return jsonify({'success': False, 'error': 'No daily challenge available.'}), 404

    user = get_current_user()
    is_solved = False
    if user:
        is_solved = s.query(Submission).filter_by(
            user_id=user.id, problem_title=prob.title, verdict='Accepted'
        ).first() is not None

    data = prob.to_dict()
    data['is_solved'] = is_solved
    return jsonify({'success': True, 'challenge': data})


@problems_bp.route('/api/topics', methods=['GET'])
@login_required
def get_topics():
    s = db_session()
    user = get_current_user()
    student = s.query(Student).filter_by(user_id=user.id).first() if user else None

    # Get distinct topics
    topics_list = ['Arrays', 'Strings', 'Loops', 'Functions', 'Searching', 'Recursion', 'Sorting', 'Linked Lists']
    result = []

    for top in topics_list:
        total = s.query(Problem).filter(Problem.topic.ilike(f"%{top}%")).count()
        if total == 0:
            total = 12 # baseline problem count

        # Solved count for user
        solved = 0
        if user:
            solved = s.query(Submission.problem_title).join(
                Problem, Problem.title == Submission.problem_title
            ).filter(
                Submission.user_id == user.id,
                Submission.verdict == 'Accepted',
                Problem.topic.ilike(f"%{top}%")
            ).distinct().count()

        pct = min(100, int((solved / max(1, total)) * 100))
        # If student has preset progress, respect that if higher
        if student:
            sp = s.query(StudentProgress).filter_by(student_id=student.id, topic=top).first()
            if sp and sp.mastery_percentage > pct:
                pct = sp.mastery_percentage
                solved = max(solved, sp.problems_solved)

        total = max(total, solved + 4, 12)

        categories = {
            'Arrays': 'Data Structures',
            'Strings': 'Data Structures',
            'Linked Lists': 'Data Structures',
            'Loops': 'Core Logic',
            'Functions': 'Core Logic',
            'Searching': 'Algorithms',
            'Recursion': 'Algorithms',
            'Sorting': 'Algorithms'
        }

        result.append({
            'topic': top,
            'category': categories.get(top, 'Data Structures'),
            'problems_solved': solved,
            'total_problems': total,
            'percentage': pct
        })

    return jsonify({'success': True, 'topics': result})
