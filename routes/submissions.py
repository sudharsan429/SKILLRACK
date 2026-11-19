import json
from flask import Blueprint, request, jsonify
from database import db_session
from models import Submission, Problem, Student, StudentProgress, Leaderboard
from services.authentication import login_required, get_current_user
from services.code_execution import execute_code, evaluate_code
from services.analytics import update_leaderboard_ranks

submissions_bp = Blueprint('submissions', __name__)

@submissions_bp.route('/api/code/run', methods=['POST'])
@login_required
def run_code():
    data = request.get_json(silent=True) or {}
    language = data.get('language', 'Python 3').strip()
    code = data.get('code', '').strip()

    if not code:
        return jsonify({
            'success': False,
            'error': 'Please provide code to run.'
        }), 400

    result = execute_code(language, code)
    return jsonify({
        'success': result.get('success', False),
        'stdout': result.get('stdout', ''),
        'stderr': result.get('stderr', ''),
        'runtime': result.get('runtime', '0.00s'),
        'memory': result.get('memory', '12.4 MB'),
        'exit_code': result.get('exit_code', 0)
    })


@submissions_bp.route('/api/submissions', methods=['POST'])
@login_required
def submit_code():
    data = request.get_json(silent=True) or {}
    problem_id = data.get('problem_id')
    problem_title = data.get('problem_title', '').strip()
    language = data.get('language', 'Python 3').strip()
    code = data.get('code', '').strip()

    if not code:
        return jsonify({'success': False, 'error': 'Code is required.'}), 400

    s = db_session()
    user = get_current_user()

    # Find problem
    prob = None
    if problem_id:
        prob = s.query(Problem).filter_by(id=problem_id).first()
    if not prob and problem_title:
        prob = s.query(Problem).filter_by(title=problem_title).first()
    if not prob:
        # Default fallback problem if title unknown
        prob = s.query(Problem).first()

    if not prob:
        return jsonify({'success': False, 'error': 'Problem not found in database.'}), 404

    # Run sandboxed evaluation
    eval_res = evaluate_code(prob, language, code)
    verdict = eval_res.get('verdict', 'Wrong Answer')
    passed = eval_res.get('passed', False)
    test_cases_passed = eval_res.get('test_cases_passed', 0)
    total_test_cases = eval_res.get('total_test_cases', 5)
    runtime = eval_res.get('runtime', '0.02s')
    memory = eval_res.get('memory', '12.4 MB')
    output_log = eval_res.get('output_log', '')

    score_awarded = prob.points if passed else 0

    student = s.query(Student).filter_by(user_id=user.id).first() if user else None

    # Check if previously accepted
    previously_accepted = False
    if user:
        prev = s.query(Submission).filter_by(
            user_id=user.id, problem_title=prob.title, verdict='Accepted'
        ).first()
        if prev:
            previously_accepted = True

    try:
        # Save submission
        submission = Submission(
            user_id=user.id,
            student_id=student.id if student else None,
            problem_id=prob.id,
            problem_title=prob.title,
            language=language,
            code=code,
            verdict=verdict,
            score=score_awarded,
            runtime=runtime,
            memory=memory,
            test_cases_passed=test_cases_passed,
            total_test_cases=total_test_cases,
            output_log=output_log
        )
        s.add(submission)

        # Award points and update progress if passed for the first time
        if passed and student:
            if not previously_accepted:
                student.points += prob.points
                student.solved_count += 1

                # Update topic progress
                topic = prob.topic or 'Arrays'
                sp = s.query(StudentProgress).filter_by(student_id=student.id, topic=topic).first()
                if not sp:
                    sp = StudentProgress(
                        student_id=student.id,
                        topic=topic,
                        problems_solved=1,
                        total_problems=10,
                        mastery_percentage=10
                    )
                    s.add(sp)
                else:
                    sp.problems_solved += 1
                    sp.mastery_percentage = min(100, int((sp.problems_solved / max(1, sp.total_problems)) * 100))

            # Recalculate accuracy
            total_subs = s.query(Submission).filter_by(user_id=user.id).count() + 1
            acc_subs = s.query(Submission).filter_by(user_id=user.id, verdict='Accepted').count() + (1 if not previously_accepted else 0)
            student.score = f"{round((acc_subs / total_subs) * 100)}%"

            s.commit()
            update_leaderboard_ranks()
        else:
            s.commit()

        return jsonify({
            'success': True,
            'verdict': verdict,
            'passed': passed,
            'score': score_awarded,
            'test_cases_passed': test_cases_passed,
            'total_test_cases': total_test_cases,
            'runtime': runtime,
            'memory': memory,
            'output_log': output_log,
            'details': eval_res.get('details', []),
            'submission': submission.to_dict()
        })
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@submissions_bp.route('/api/submissions', methods=['GET'])
@login_required
def get_submissions():
    s = db_session()
    user = get_current_user()

    # If student, return only user's submissions
    # If faculty/admin/super and user_id is provided, filter by that; else all or user's
    target_user_id = request.args.get('user_id')
    limit = int(request.args.get('limit', 50))

    query = s.query(Submission)
    if user.role == 'student' or not target_user_id:
        if user.role == 'student':
            query = query.filter_by(user_id=user.id)
        elif target_user_id:
            query = query.filter_by(user_id=int(target_user_id))
    else:
        query = query.filter_by(user_id=int(target_user_id))

    submissions = query.order_by(Submission.submitted_at.desc()).limit(limit).all()
    return jsonify({
        'success': True,
        'count': len(submissions),
        'submissions': [sub.to_dict() for sub in submissions]
    })
