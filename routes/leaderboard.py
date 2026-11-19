from flask import Blueprint, request, jsonify
from database import db_session
from models import Leaderboard, Student
from services.authentication import login_required
from services.analytics import update_leaderboard_ranks

leaderboard_bp = Blueprint('leaderboard', __name__)

@leaderboard_bp.route('/api/leaderboard', methods=['GET'])
@login_required
def get_leaderboard():
    s = db_session()
    # Update ranks first to ensure consistency
    update_leaderboard_ranks()

    limit = int(request.args.get('limit', 50))
    entries = s.query(Leaderboard).order_by(Leaderboard.rank.asc()).limit(limit).all()

    return jsonify({
        'success': True,
        'count': len(entries),
        'leaderboard': [e.to_dict() for e in entries]
    })


@leaderboard_bp.route('/api/leaderboard/kudos/<int:student_id>', methods=['POST'])
@login_required
def give_kudos(student_id):
    s = db_session()
    lb = s.query(Leaderboard).filter_by(student_id=student_id).first()
    if not lb:
        return jsonify({'success': False, 'error': 'Student not found in leaderboard.'}), 404

    lb.kudos_count = (lb.kudos_count or 0) + 1
    try:
        s.commit()
        return jsonify({
            'success': True,
            'message': f"Kudos sent to {lb.student.name if lb.student else 'student'}!",
            'kudos_count': lb.kudos_count
        })
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
