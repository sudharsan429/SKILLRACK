from flask import Blueprint, request, jsonify
from database import db_session
from models import UserSetting
from services.authentication import login_required, get_current_user

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/api/settings', methods=['GET'])
@login_required
def get_settings():
    s = db_session()
    user = get_current_user()
    setting = s.query(UserSetting).filter_by(user_id=user.id).first()

    if not setting:
        setting = UserSetting(
            user_id=user.id,
            theme='light',
            email_notifications=True,
            daily_reminders=True,
            weekly_summary=False
        )
        s.add(setting)
        s.commit()

    return jsonify({
        'success': True,
        'settings': setting.to_dict()
    })


@settings_bp.route('/api/settings', methods=['PUT'])
@login_required
def update_settings():
    data = request.get_json(silent=True) or {}
    s = db_session()
    user = get_current_user()

    setting = s.query(UserSetting).filter_by(user_id=user.id).first()
    if not setting:
        setting = UserSetting(user_id=user.id)
        s.add(setting)

    if 'theme' in data:
        t = data['theme'].strip().lower()
        if t in ['light', 'dark']:
            setting.theme = t
    if 'email_notifications' in data:
        setting.email_notifications = bool(data['email_notifications'])
    if 'daily_reminders' in data:
        setting.daily_reminders = bool(data['daily_reminders'])
    if 'weekly_summary' in data:
        setting.weekly_summary = bool(data['weekly_summary'])

    try:
        s.commit()
        return jsonify({
            'success': True,
            'message': 'Settings saved successfully.',
            'settings': setting.to_dict()
        })
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
