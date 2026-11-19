import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, 'instance')
os.makedirs(INSTANCE_DIR, exist_ok=True)

DB_PATH = os.path.join(INSTANCE_DIR, 'codecampus.db')

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'codecampus-super-secret-key-ist-2026')
    DATABASE_PATH = DB_PATH
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DB_PATH.replace(os.sep, '/')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Session Configuration
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = False  # Set to True in production with HTTPS
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    
    # Code Execution Sandbox Configuration
    CODE_EXECUTION_TIMEOUT = 4.0  # seconds
    MAX_OUTPUT_LENGTH = 65536     # 64 KB
