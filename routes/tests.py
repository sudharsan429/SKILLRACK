import json
from flask import Blueprint, request, jsonify
from database import db_session
from models import ScheduledTest, TestQuestion, TestResult, Student
from services.authentication import login_required, role_required, get_current_user

tests_bp = Blueprint('tests', __name__)

@tests_bp.route('/api/tests', methods=['GET'])
@login_required
def get_tests():
    s = db_session()
    user = get_current_user()
    tests = s.query(ScheduledTest).order_by(ScheduledTest.id.desc()).all()

    # If student, check if they already took each test
    student = s.query(Student).filter_by(user_id=user.id).first() if user else None

    result = []
    for t in tests:
        d = t.to_dict()
        if student:
            res = s.query(TestResult).filter_by(test_id=t.id, student_id=student.id).first()
            d['taken'] = res is not None
            d['user_score'] = res.score if res else None
            d['user_percentage'] = res.percentage if res else None
        result.append(d)

    return jsonify({
        'success': True,
        'count': len(result),
        'tests': result
    })


@tests_bp.route('/api/tests/<int:test_id>', methods=['GET'])
@login_required
def get_test_details(test_id):
    s = db_session()
    test = s.query(ScheduledTest).filter_by(id=test_id).first()
    if not test:
        return jsonify({'success': False, 'error': 'Test not found.'}), 404

    user = get_current_user()
    questions = s.query(TestQuestion).filter_by(test_id=test.id).order_by(TestQuestion.question_number.asc()).all()

    # Hide correct answers for students unless faculty/admin/super
    q_data = []
    for q in questions:
        qd = q.to_dict()
        if user.role in ['faculty', 'admin', 'super']:
            qd['correct_answer'] = q.correct_answer
        q_data.append(qd)

    test_data = test.to_dict()
    test_data['questions'] = q_data

    # Check if student already submitted
    if user.role == 'student':
        student = s.query(Student).filter_by(user_id=user.id).first()
        if student:
            res = s.query(TestResult).filter_by(test_id=test.id, student_id=student.id).first()
            if res:
                test_data['submission'] = res.to_dict()

    return jsonify({'success': True, 'test': test_data})


@tests_bp.route('/api/tests', methods=['POST'])
@role_required(['faculty', 'admin', 'super'])
def create_test():
    data = request.get_json(silent=True) or {}
    title = data.get('title', '').strip()
    scheduled_date = data.get('scheduled_date', '').strip()
    duration_minutes = int(data.get('duration_minutes', 60))
    questions_list = data.get('questions', [])

    if not title or not scheduled_date:
        return jsonify({'success': False, 'error': 'Title and Scheduled Date are required.'}), 400

    s = db_session()
    user = get_current_user()

    try:
        test = ScheduledTest(
            title=title,
            scheduled_date=scheduled_date,
            duration_minutes=duration_minutes,
            question_count=len(questions_list) if questions_list else 1,
            status='Active',
            created_by=user.id
        )
        s.add(test)
        s.flush()

        if questions_list:
            for idx, q in enumerate(questions_list, 1):
                options = q.get('options', [])
                if isinstance(options, list):
                    options = json.dumps(options)
                tq = TestQuestion(
                    test_id=test.id,
                    question_number=idx,
                    question_text=q.get('question_text', f'Question {idx}'),
                    options_json=options,
                    correct_answer=str(q.get('correct_answer', '')),
                    points=int(q.get('points', 10))
                )
                s.add(tq)
        else:
            # Default sample question
            tq = TestQuestion(
                test_id=test.id,
                question_number=1,
                question_text='What is the time complexity of binary search on a sorted array of size n?',
                options_json=json.dumps(['O(1)', 'O(log n)', 'O(n)', 'O(n^2)']),
                correct_answer='O(log n)',
                points=10
            )
            s.add(tq)

        s.commit()
        return jsonify({
            'success': True,
            'message': f"Test '{title}' created successfully.",
            'test': test.to_dict()
        }), 201
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@tests_bp.route('/api/tests/<int:test_id>/submit', methods=['POST'])
@login_required
def submit_test(test_id):
    s = db_session()
    user = get_current_user()
    student = s.query(Student).filter_by(user_id=user.id).first()

    if not student:
        return jsonify({'success': False, 'error': 'Only registered students can submit tests.'}), 403

    test = s.query(ScheduledTest).filter_by(id=test_id).first()
    if not test:
        return jsonify({'success': False, 'error': 'Test not found.'}), 404

    # Check if already submitted
    existing = s.query(TestResult).filter_by(test_id=test.id, student_id=student.id).first()
    if existing:
        return jsonify({
            'success': False,
            'error': 'You have already submitted this test.',
            'result': existing.to_dict()
        }), 400

    data = request.get_json(silent=True) or {}
    answers = data.get('answers', {}) # dict of question_id: selected_option

    questions = s.query(TestQuestion).filter_by(test_id=test.id).all()
    total_score = sum(q.points for q in questions) or 100
    score = 0
    breakdown = []

    for q in questions:
        user_ans = str(answers.get(str(q.id), answers.get(q.id, ''))).strip()
        is_correct = user_ans.lower() == q.correct_answer.lower()
        if is_correct:
            score += q.points
        breakdown.append({
            'question_id': q.id,
            'question_text': q.question_text,
            'user_answer': user_ans,
            'correct_answer': q.correct_answer,
            'is_correct': is_correct,
            'points_awarded': q.points if is_correct else 0
        })

    percentage = round((score / max(1, total_score)) * 100, 1)

    try:
        result = TestResult(
            test_id=test.id,
            student_id=student.id,
            score=score,
            total_score=total_score,
            percentage=percentage
        )
        s.add(result)
        s.commit()

        return jsonify({
            'success': True,
            'message': f"Test submitted successfully! Your score: {score}/{total_score} ({percentage}%).",
            'score': score,
            'total_score': total_score,
            'percentage': percentage,
            'breakdown': breakdown
        })
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@tests_bp.route('/api/tests/<int:test_id>/results', methods=['GET'])
@role_required(['faculty', 'admin', 'super'])
def get_test_results(test_id):
    s = db_session()
    test = s.query(ScheduledTest).filter_by(id=test_id).first()
    if not test:
        return jsonify({'success': False, 'error': 'Test not found.'}), 404

    results = s.query(TestResult).filter_by(test_id=test.id).all()
    return jsonify({
        'success': True,
        'test_title': test.title,
        'results': [r.to_dict() for r in results]
    })
