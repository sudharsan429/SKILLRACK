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
            weekly_summary=False,
            preferences_json='{}'
        )
        s.add(setting)
        s.commit()

    d = setting.to_dict()
    d['role'] = user.role
    d['user_name'] = user.name

    return jsonify({
        'success': True,
        'settings': d
    })


@settings_bp.route('/api/settings', methods=['PUT'])
@login_required
def update_settings():
    import json
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

    # Merge role-specific preferences
    existing_prefs = {}
    if setting.preferences_json:
        try:
            existing_prefs = json.loads(setting.preferences_json)
        except Exception:
            existing_prefs = {}

    if 'preferences' in data and isinstance(data['preferences'], dict):
        existing_prefs.update(data['preferences'])

    known_keys = {'theme', 'email_notifications', 'daily_reminders', 'weekly_summary', 'preferences'}
    for k, v in data.items():
        if k not in known_keys:
            existing_prefs[k] = v

    setting.preferences_json = json.dumps(existing_prefs)

    try:
        s.commit()
        d = setting.to_dict()
        d['role'] = user.role
        d['user_name'] = user.name
        return jsonify({
            'success': True,
            'message': f"{user.role.capitalize()} settings saved successfully.",
            'settings': d
        })
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
