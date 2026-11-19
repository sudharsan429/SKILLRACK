import json
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, func
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class College(Base):
    __tablename__ = 'colleges'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False, unique=True)
    location = Column(String(100), nullable=False)
    status = Column(String(50), default='Active')  # Active, Pending, Inactive
    licence_expiry = Column(String(50), nullable=False, default='2027-12-31')
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    departments = relationship('Department', back_populates='college', cascade='all, delete-orphan')
    students = relationship('Student', back_populates='college')
    faculty_members = relationship('Faculty', back_populates='college')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'location': self.location,
            'status': self.status,
            'licence_expiry': self.licence_expiry,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Department(Base):
    __tablename__ = 'departments'

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), nullable=False, unique=True)  # D01, CSE
    name = Column(String(150), nullable=False)
    short_code = Column(String(20), nullable=False)        # CSE
    details = Column(String(150))                         # e.g. CSE · 240 Students
    status = Column(String(50), default='Active')
    college_id = Column(Integer, ForeignKey('colleges.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    college = relationship('College', back_populates='departments')
    batches = relationship('Batch', back_populates='department', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'short_code': self.short_code,
            'details': self.details or f"{self.short_code} Department",
            'status': self.status,
            'college_id': self.college_id
        }


class Batch(Base):
    __tablename__ = 'batches'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True) # 2024-A
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=True)
    department_code = Column(String(20), default='CSE')
    year = Column(String(10), default='2024')
    student_count = Column(Integer, default=0)
    details = Column(String(100))                         # e.g. '48 students'
    status = Column(String(50), default='Active')
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship('Department', back_populates='batches')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'department_code': self.department_code,
            'year': self.year,
            'student_count': self.student_count,
            'details': self.details or f"{self.student_count} students",
            'status': self.status
        }


class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(120), nullable=False, unique=True, index=True)
    roll_number = Column(String(50), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False)  # student, faculty, admin, super
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student_record = relationship('Student', back_populates='user', uselist=False, cascade='all, delete-orphan')
    faculty_record = relationship('Faculty', back_populates='user', uselist=False, cascade='all, delete-orphan')
    profile_record = relationship('Profile', back_populates='user', uselist=False, cascade='all, delete-orphan')
    settings_record = relationship('UserSetting', back_populates='user', uselist=False, cascade='all, delete-orphan')
    submissions = relationship('Submission', back_populates='user')

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'roll_number': self.roll_number,
            'role': self.role,
            'name': self.name,
            'is_active': self.is_active
        }


class Student(Base):
    __tablename__ = 'students'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), unique=True, nullable=False)
    student_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), nullable=False)
    department = Column(String(50), default='CSE')
    batch = Column(String(50), default='2024-A')
    details = Column(String(100)) # e.g. 'CSE · A'
    score = Column(String(20), default='86%') # Accuracy or average score
    status = Column(String(50), default='Active') # Active, Needs support
    points = Column(Integer, default=420)
    solved_count = Column(Integer, default=18)
    streak_days = Column(Integer, default=6)
    college_id = Column(Integer, ForeignKey('colleges.id'), nullable=True)
    support_plan = Column(Text, nullable=True)
    support_plan_date = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship('User', back_populates='student_record')
    college = relationship('College', back_populates='students')
    test_results = relationship('TestResult', back_populates='student', cascade='all, delete-orphan')
    progress_records = relationship('StudentProgress', back_populates='student', cascade='all, delete-orphan')
    leaderboard_entry = relationship('Leaderboard', back_populates='student', uselist=False, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'student_code': self.student_code,
            'name': self.name,
            'email': self.email,
            'department': self.department,
            'batch': self.batch,
            'details': self.details or f"{self.department} · {self.batch}",
            'score': self.score,
            'status': self.status,
            'points': self.points,
            'solved_count': self.solved_count,
            'streak_days': self.streak_days,
            'support_plan': self.support_plan,
            'support_plan_date': self.support_plan_date
        }


class Faculty(Base):
    __tablename__ = 'faculty'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), unique=True, nullable=False)
    faculty_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), nullable=False)
    department = Column(String(50), default='CSE')
    details = Column(String(150)) # e.g. 'CSE · Head of Dept'
    status = Column(String(50), default='Active')
    college_id = Column(Integer, ForeignKey('colleges.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship('User', back_populates='faculty_record')
    college = relationship('College', back_populates='faculty_members')

    def to_dict(self):
        return {
            'id': self.id,
            'faculty_code': self.faculty_code,
            'name': self.name,
            'email': self.email,
            'department': self.department,
            'details': self.details or f"{self.department} · Faculty",
            'status': self.status
        }


class Problem(Base):
    __tablename__ = 'problems'

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(150), nullable=False, unique=True, index=True)
    difficulty = Column(String(20), nullable=False, default='Easy') # Easy, Medium, Hard
    topic = Column(String(50), nullable=False, default='Arrays')
    points = Column(Integer, nullable=False, default=20)
    description = Column(Text, nullable=False)
    sample_input = Column(Text, default='')
    sample_output = Column(Text, default='')
    starter_code_py = Column(Text, default='')
    starter_code_java = Column(Text, default='')
    starter_code_c = Column(Text, default='')
    starter_code_cpp = Column(Text, default='')
    starter_code_js = Column(Text, default='')
    test_cases_json = Column(Text, default='[]')
    is_daily = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    assignments = relationship('ProblemAssignment', back_populates='problem', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'difficulty': self.difficulty,
            'topic': self.topic,
            'points': self.points,
            'description': self.description,
            'sample_input': self.sample_input,
            'sample_output': self.sample_output,
            'starter_code_py': self.starter_code_py,
            'starter_code_java': self.starter_code_java,
            'starter_code_c': self.starter_code_c,
            'starter_code_cpp': self.starter_code_cpp,
            'starter_code_js': self.starter_code_js,
            'is_daily': self.is_daily
        }


class ProblemAssignment(Base):
    __tablename__ = 'problem_assignments'

    id = Column(Integer, primary_key=True, autoincrement=True)
    problem_id = Column(Integer, ForeignKey('problems.id'), nullable=False)
    assigned_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    batch_name = Column(String(100), nullable=False)
    due_date = Column(String(50), nullable=False)
    instructions = Column(Text, nullable=True)
    status = Column(String(50), default='Active')
    created_at = Column(DateTime, default=datetime.utcnow)

    problem = relationship('Problem', back_populates='assignments')
    assigner = relationship('User')

    def to_dict(self):
        return {
            'id': self.id,
            'problem_id': self.problem_id,
            'problem_title': self.problem.title if self.problem else 'Unknown',
            'batch_name': self.batch_name,
            'due_date': self.due_date,
            'instructions': self.instructions or '',
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Submission(Base):
    __tablename__ = 'submissions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    student_id = Column(Integer, ForeignKey('students.id'), nullable=True)
    problem_id = Column(Integer, ForeignKey('problems.id'), nullable=True)
    problem_title = Column(String(150), nullable=False)
    language = Column(String(50), nullable=False, default='Python 3')
    code = Column(Text, nullable=False)
    verdict = Column(String(50), nullable=False) # Accepted, Wrong Answer, Time Limit Exceeded, Runtime Error
    score = Column(Integer, default=0)
    runtime = Column(String(30), default='0.02s')
    memory = Column(String(30), default='12.4 MB')
    test_cases_passed = Column(Integer, default=0)
    total_test_cases = Column(Integer, default=5)
    output_log = Column(Text, default='')
    submitted_at = Column(DateTime, default=datetime.utcnow)

    user = relationship('User', back_populates='submissions')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'problem_title': self.problem_title,
            'language': self.language,
            'verdict': self.verdict,
            'score': self.score,
            'runtime': self.runtime,
            'memory': self.memory,
            'test_cases_passed': self.test_cases_passed,
            'total_test_cases': self.total_test_cases,
            'output_log': self.output_log,
            'submitted_at': self.submitted_at.strftime('%d %b %Y, %H:%M') if self.submitted_at else 'Just now'
        }


class ScheduledTest(Base):
    __tablename__ = 'scheduled_tests'

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(150), nullable=False)
    scheduled_date = Column(String(50), nullable=False) # e.g. 2026-11-20
    duration_minutes = Column(Integer, nullable=False, default=60)
    question_count = Column(Integer, nullable=False, default=1)
    status = Column(String(50), default='Active') # Active, Completed, Upcoming
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    questions = relationship('TestQuestion', back_populates='test', cascade='all, delete-orphan')
    results = relationship('TestResult', back_populates='test', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'scheduled_date': self.scheduled_date,
            'duration_minutes': self.duration_minutes,
            'question_count': self.question_count,
            'status': self.status
        }


class TestQuestion(Base):
    __tablename__ = 'test_questions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    test_id = Column(Integer, ForeignKey('scheduled_tests.id'), nullable=False)
    question_number = Column(Integer, nullable=False, default=1)
    question_text = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False) # JSON list e.g. ["6", "8", "9", "16"]
    correct_answer = Column(String(100), nullable=False)
    points = Column(Integer, default=10)

    test = relationship('ScheduledTest', back_populates='questions')

    def to_dict(self):
        opts = []
        try:
            opts = json.loads(self.options_json)
        except Exception:
            opts = []
        return {
            'id': self.id,
            'test_id': self.test_id,
            'question_number': self.question_number,
            'question_text': self.question_text,
            'options': opts,
            'points': self.points
        }


class TestResult(Base):
    __tablename__ = 'test_results'

    id = Column(Integer, primary_key=True, autoincrement=True)
    test_id = Column(Integer, ForeignKey('scheduled_tests.id'), nullable=False)
    student_id = Column(Integer, ForeignKey('students.id'), nullable=False)
    score = Column(Integer, nullable=False)
    total_score = Column(Integer, nullable=False)
    percentage = Column(Float, nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    test = relationship('ScheduledTest', back_populates='results')
    student = relationship('Student', back_populates='test_results')

    def to_dict(self):
        return {
            'id': self.id,
            'test_id': self.test_id,
            'student_id': self.student_id,
            'student_name': self.student.name if self.student else 'Unknown',
            'score': self.score,
            'total_score': self.total_score,
            'percentage': self.percentage,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None
        }


class Leaderboard(Base):
    __tablename__ = 'leaderboard'

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey('students.id'), unique=True, nullable=False)
    rank = Column(Integer, default=1)
    points = Column(Integer, default=0)
    solved_count = Column(Integer, default=0)
    streak_days = Column(Integer, default=0)
    kudos_count = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship('Student', back_populates='leaderboard_entry')

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'name': self.student.name if self.student else 'Unknown',
            'department': self.student.department if self.student else 'CSE',
            'batch': self.student.batch if self.student else '2024-A',
            'rank': self.rank,
            'points': self.points,
            'solved_count': self.solved_count,
            'streak_days': self.streak_days,
            'kudos_count': self.kudos_count
        }


class StudentProgress(Base):
    __tablename__ = 'student_progress'

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey('students.id'), nullable=False)
    topic = Column(String(50), nullable=False)
    problems_solved = Column(Integer, default=0)
    total_problems = Column(Integer, default=10)
    mastery_percentage = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow)

    student = relationship('Student', back_populates='progress_records')

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'topic': self.topic,
            'problems_solved': self.problems_solved,
            'total_problems': self.total_problems,
            'mastery_percentage': self.mastery_percentage
        }


class Profile(Base):
    __tablename__ = 'profiles'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), unique=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(120), nullable=False)
    roll_number = Column(String(50))
    department = Column(String(100), default='Computer Science and Engineering')
    batch = Column(String(50), default='2024 - 2028 · Section A')
    college = Column(String(150), default='ABC Engineering College')
    bio = Column(Text, default='Passionate about algorithms, system design and web development.')
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship('User', back_populates='profile_record')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'full_name': self.full_name,
            'email': self.email,
            'roll_number': self.roll_number,
            'department': self.department,
            'batch': self.batch,
            'college': self.college,
            'bio': self.bio
        }


class UserSetting(Base):
    __tablename__ = 'user_settings'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), unique=True, nullable=False)
    theme = Column(String(20), default='light') # light, dark
    email_notifications = Column(Boolean, default=True)
    daily_reminders = Column(Boolean, default=True)
    weekly_summary = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship('User', back_populates='settings_record')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'theme': self.theme,
            'email_notifications': bool(self.email_notifications),
            'daily_reminders': bool(self.daily_reminders),
            'weekly_summary': bool(self.weekly_summary)
        }
