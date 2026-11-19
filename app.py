import os
from flask import Flask, render_template, jsonify, request
from config import Config
from database import init_db, db_session

# Import all route blueprints
from routes.auth import auth_bp
from routes.dashboard import dashboard_bp
from routes.students import students_bp
from routes.faculty import faculty_bp
from routes.problems import problems_bp
from routes.assignments import assignments_bp
from routes.submissions import submissions_bp
from routes.tests import tests_bp
from routes.leaderboard import leaderboard_bp
from routes.profile import profile_bp
from routes.settings import settings_bp
from routes.admin import admin_bp

def create_app():
    app = Flask(
        __name__,
        template_folder=os.path.join(os.path.dirname(__file__), 'templates'),
        static_folder=os.path.join(os.path.dirname(__file__), 'static')
    )
    app.config.from_object(Config)

    # Initialize Database and seed data
    init_db()

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(students_bp)
    app.register_blueprint(faculty_bp)
    app.register_blueprint(problems_bp)
    app.register_blueprint(assignments_bp)
    app.register_blueprint(submissions_bp)
    app.register_blueprint(tests_bp)
    app.register_blueprint(leaderboard_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(admin_bp)

    # Remove database session after each request
    @app.teardown_appcontext
    def shutdown_session(exception=None):
        db_session.remove()

    # Root route - serves the full-stack single page application
    @app.route('/')
    def index():
        return render_template('index.html')

    # Global error handlers
    @app.errorhandler(404)
    def not_found_error(error):
        if request.path.startswith('/api/'):
            return jsonify({'success': False, 'error': 'Endpoint not found.'}), 404
        return render_template('index.html'), 200

    @app.errorhandler(500)
    def internal_error(error):
        db_session.rollback()
        if request.path.startswith('/api/'):
            return jsonify({'success': False, 'error': 'Internal server error occurred.'}), 500
        return render_template('index.html'), 500

    return app

app = create_app()

if __name__ == '__main__':
    print("SKILLRACK Flask server running at http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
