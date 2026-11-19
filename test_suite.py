import os
import sys
import time

# Ensure project root is in path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import app
from database import db_session
from models import User, Student, Faculty, Problem, Submission, ScheduledTest, College, Department, Batch

def run_tests():
    print("==================================================")
    print("SKILLRACK Full-Stack Verification Test Suite")
    print("==================================================")

    client = app.test_client()

    # ---------------------------------------------------------
    # Scenario 1: Valid login for all 4 roles
    # ---------------------------------------------------------
    print("\n--- Test Scenario 1: Valid Login for all 4 roles ---")
    roles = [
        ('student@demo.com', 'demo123', 'student', 'Alex Morgan'),
        ('faculty@demo.com', 'demo123', 'faculty', 'Dr. Priya Kumar'),
        ('admin@demo.com', 'demo123', 'admin', 'Karthik Raman'),
        ('super@demo.com', 'demo123', 'super', 'Platform Admin')
    ]
    for email, pw, expected_role, expected_name in roles:
        res = client.post('/api/login', json={'identifier': email, 'password': pw})
        data = res.get_json()
        assert res.status_code == 200, f"Login failed for {email}: {data}"
        assert data['success'] is True
        assert data['user']['role'] == expected_role, f"Expected role {expected_role}, got {data['user']['role']}"
        assert expected_name in data['user']['name']
        print(f"  ✓ Valid login for {email} -> Role: {data['user']['role']}, Name: {data['user']['name']}")

    # ---------------------------------------------------------
    # Scenario 2: Invalid login
    # ---------------------------------------------------------
    print("\n--- Test Scenario 2: Invalid Login ---")
    res = client.post('/api/login', json={'identifier': 'student@demo.com', 'password': 'wrongpassword'})
    assert res.status_code == 401
    assert res.get_json()['success'] is False
    print("  ✓ Invalid password rejected with 401 Unauthorized")

    res = client.post('/api/login', json={'identifier': 'nonexistent@demo.com', 'password': 'demo'})
    assert res.status_code == 401
    print("  ✓ Non-existent user rejected with 401 Unauthorized")

    # ---------------------------------------------------------
    # Scenario 3: Logout and Session Expiration
    # ---------------------------------------------------------
    print("\n--- Test Scenario 3: Logout and Session Expiration ---")
    client.post('/api/login', json={'identifier': 'student@demo.com', 'password': 'demo123'})
    res = client.get('/api/session')
    assert res.get_json()['authenticated'] is True
    print("  ✓ Session active before logout")

    res = client.post('/api/logout')
    assert res.status_code == 200
    assert res.get_json()['success'] is True

    res = client.get('/api/session')
    assert res.get_json()['authenticated'] is False
    print("  ✓ Session successfully destroyed after logout")

    # ---------------------------------------------------------
    # Scenario 4: Role-Based Access Restrictions
    # ---------------------------------------------------------
    print("\n--- Test Scenario 4: Role-Based Access Restrictions ---")
    client.post('/api/login', json={'identifier': 'student@demo.com', 'password': 'demo123'})
    res = client.post('/api/colleges', json={'name': 'Hacked College', 'location': 'Nowhere'})
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    print("  ✓ Student blocked from POST /api/colleges with 403 Forbidden")

    res = client.post('/api/faculty', json={'name': 'Fake Faculty', 'email': 'fake@faculty.com'})
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    print("  ✓ Student blocked from POST /api/faculty with 403 Forbidden")

    # ---------------------------------------------------------
    # Scenario 5: Student CRUD Operations
    # ---------------------------------------------------------
    print("\n--- Test Scenario 5: Student CRUD Operations ---")
    client.post('/api/login', json={'identifier': 'admin@demo.com', 'password': 'demo123'})

    res = client.post('/api/students', json={
        'name': 'Test Student 99',
        'email': f'student99_{int(time.time())}@test.com',
        'student_code': f'STU_{int(time.time())}',
        'department': 'CSE',
        'batch': '2024-A'
    })
    assert res.status_code == 201, f"Failed: {res.get_json()}"
    new_student = res.get_json()['student']
    new_student_id = new_student['id']
    print(f"  ✓ Created student (ID: {new_student_id})")

    res = client.get(f'/api/students/{new_student_id}')
    assert res.status_code == 200
    assert res.get_json()['student']['name'] == 'Test Student 99'
    print("  ✓ Read student details verified")

    res = client.put(f'/api/students/{new_student_id}', json={
        'name': 'Test Student 99 Updated',
        'score': '95%'
    })
    assert res.status_code == 200
    assert res.get_json()['student']['name'] == 'Test Student 99 Updated'
    print("  ✓ Updated student name and score")

    res = client.delete(f'/api/students/{new_student_id}')
    assert res.status_code == 200
    assert res.get_json()['success'] is True
    print("  ✓ Deleted student record")

    # ---------------------------------------------------------
    # Scenario 6: Faculty CRUD Operations
    # ---------------------------------------------------------
    print("\n--- Test Scenario 6: Faculty CRUD Operations ---")
    res = client.post('/api/faculty', json={
        'name': 'Dr. Test Professor',
        'email': f'prof.test_{int(time.time())}@college.edu',
        'department': 'CSE',
        'details': 'CSE · Algorithms Specialist'
    })
    assert res.status_code == 201
    fac_id = res.get_json()['faculty']['id']
    print(f"  ✓ Created faculty member (ID: {fac_id})")

    res = client.get(f'/api/faculty/{fac_id}')
    assert res.status_code == 200
    print("  ✓ Read faculty member verified")

    res = client.put(f'/api/faculty/{fac_id}', json={'details': 'CSE · Lead Researcher'})
    assert res.status_code == 200
    print("  ✓ Updated faculty details")

    res = client.delete(f'/api/faculty/{fac_id}')
    assert res.status_code == 200
    print("  ✓ Deleted faculty member")

    # ---------------------------------------------------------
    # Scenario 7: Problem Creation and Assignment
    # ---------------------------------------------------------
    print("\n--- Test Scenario 7: Problem Creation and Assignment ---")
    prob_title = f"Unit Test Problem {int(time.time())}"
    client.post('/api/login', json={'identifier': 'faculty@demo.com', 'password': 'demo123'})

    res = client.post('/api/problems', json={
        'title': prob_title,
        'difficulty': 'Easy',
        'topic': 'Loops',
        'points': 25,
        'description': 'A test problem to verify dynamic database insertion.',
        'sample_input': '5',
        'sample_output': '15',
        'starter_code_py': 'def solve(n):\n    return sum(range(n+1))\n\nprint(solve(5))'
    })
    assert res.status_code == 201
    problem_id = res.get_json()['problem']['id']
    print(f"  ✓ Problem created in SQLite (ID: {problem_id}, Title: {prob_title})")

    res = client.post('/api/assignments', json={
        'problem_id': problem_id,
        'batch_name': '2024-A',
        'due_date': '2026-11-30',
        'instructions': 'Complete as part of homework'
    })
    assert res.status_code == 201
    assign_id = res.get_json()['assignment']['id']
    print(f"  ✓ Problem assigned to batch 2024-A (ID: {assign_id})")

    # ---------------------------------------------------------
    # Scenario 8: Sandboxed Code Execution and Submission
    # ---------------------------------------------------------
    print("\n--- Test Scenario 8: Sandboxed Code Execution and Submission ---")
    client.post('/api/login', json={'identifier': 'student@demo.com', 'password': 'demo123'})

    res = client.post('/api/code/run', json={
        'language': 'Python 3',
        'code': 'print("Hello from CodeCampus sandbox!")\nprint(2 + 3)'
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    assert 'Hello from CodeCampus sandbox!' in data['stdout']
    assert '5' in data['stdout']
    print(f"  ✓ Sandboxed execution verified (Runtime: {data['runtime']}, Memory: {data['memory']})")

    valid_two_sum = '''def solution(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []
'''
    res = client.post('/api/submissions', json={
        'problem_id': 1,
        'language': 'Python 3',
        'code': valid_two_sum
    })
    assert res.status_code == 200
    sub_data = res.get_json()
    assert sub_data['verdict'] == 'Accepted'
    assert sub_data['passed'] is True
    assert sub_data['test_cases_passed'] == 5
    print(f"  ✓ Solution submission evaluated: Verdict={sub_data['verdict']}, 5/5 cases passed")

    # ---------------------------------------------------------
    # Scenario 9: Test Creation and Student Test Submission
    # ---------------------------------------------------------
    print("\n--- Test Scenario 9: Test Creation and Student Submission ---")
    client.post('/api/login', json={'identifier': 'faculty@demo.com', 'password': 'demo123'})
    res = client.post('/api/tests', json={
        'title': f'Midterm Python Quiz {int(time.time())}',
        'scheduled_date': '2026-11-25',
        'duration_minutes': 45,
        'questions': [
            {
                'question_text': 'What is the return type of len()?',
                'options': ['int', 'float', 'str', 'bool'],
                'correct_answer': 'int',
                'points': 50
            },
            {
                'question_text': 'Which keyword creates a function?',
                'options': ['func', 'def', 'fn', 'function'],
                'correct_answer': 'def',
                'points': 50
            }
        ]
    })
    assert res.status_code == 201
    quiz_id = res.get_json()['test']['id']
    print(f"  ✓ Scheduled test created (ID: {quiz_id})")

    client.post('/api/login', json={'identifier': 'student@demo.com', 'password': 'demo123'})
    res = client.get(f'/api/tests/{quiz_id}')
    assert res.status_code == 200
    questions = res.get_json()['test']['questions']
    assert len(questions) == 2
    assert 'correct_answer' not in questions[0]
    print("  ✓ Questions retrieved without answer leakage to student")

    answers = {str(questions[0]['id']): 'int', str(questions[1]['id']): 'def'}
    res = client.post(f'/api/tests/{quiz_id}/submit', json={'answers': answers})
    assert res.status_code == 200
    sub_res = res.get_json()
    assert sub_res['score'] == 100
    assert sub_res['percentage'] == 100.0
    print(f"  ✓ Test submitted and graded: Score {sub_res['score']}/{sub_res['total_score']} ({sub_res['percentage']}%)")

    # ---------------------------------------------------------
    # Scenario 10: Leaderboard Calculation
    # ---------------------------------------------------------
    print("\n--- Test Scenario 10: Leaderboard Calculation ---")
    res = client.get('/api/leaderboard')
    assert res.status_code == 200
    lb = res.get_json()['leaderboard']
    assert len(lb) > 0
    assert lb[0]['rank'] == 1
    assert lb[0]['points'] >= lb[1]['points']
    print(f"  ✓ Leaderboard dynamically ranked ({len(lb)} students listed, Rank 1: {lb[0]['name']} with {lb[0]['points']} pts)")

    # ---------------------------------------------------------
    # Scenario 11: Profile Updates
    # ---------------------------------------------------------
    print("\n--- Test Scenario 11: Profile Updates ---")
    res = client.get('/api/profile')
    assert res.status_code == 200

    res = client.put('/api/profile', json={
        'full_name': 'Alex Morgan Updated',
        'bio': 'Full Stack Developer & AI enthusiast.'
    })
    assert res.status_code == 200
    assert res.get_json()['profile']['full_name'] == 'Alex Morgan Updated'
    print("  ✓ Profile updated in SQLite")

    client.put('/api/profile', json={'full_name': 'Alex Morgan'})

    # ---------------------------------------------------------
    # Scenario 12: CSV Import
    # ---------------------------------------------------------
    print("\n--- Test Scenario 12: CSV Bulk Import ---")
    client.post('/api/login', json={'identifier': 'admin@demo.com', 'password': 'demo123'})
    t_stamp = int(time.time())
    csv_data = f"""roll_number,name,email,department,batch
STU_{t_stamp}_1,Arjun Reddy,arjun_{t_stamp}_1@test.edu,CSE,2024-A
STU_{t_stamp}_2,Kavya Krishnan,kavya_{t_stamp}_2@test.edu,IT,2024-A
STU_{t_stamp}_3,Bhavna Sen,bhavna_{t_stamp}_3@test.edu,ECE,2024-B
"""
    res = client.post('/api/students/bulk-import', json={'csv_data': csv_data})
    assert res.status_code == 200, f"Error: {res.get_json()}"
    b_res = res.get_json()
    assert b_res['imported_count'] == 3
    print(f"  ✓ CSV bulk import validated and inserted 3 records into SQLite")

    # ---------------------------------------------------------
    # Scenario 13: Dashboard Statistics
    # ---------------------------------------------------------
    print("\n--- Test Scenario 13: Dashboard Statistics ---")
    client.post('/api/login', json={'identifier': 'student@demo.com', 'password': 'demo123'})
    res = client.get('/api/dashboard')
    assert res.status_code == 200
    d = res.get_json().get('data', res.get_json())
    assert 'solved' in d and 'points' in d and 'streak' in d and 'accuracy' in d
    assert len(d['weekly_activity']) == 7
    print(f"  ✓ Student Dashboard: Solved={d['solved']}, Points={d['points']}, Streak={d['streak']}, Accuracy={d['accuracy']}")

    client.post('/api/login', json={'identifier': 'super@demo.com', 'password': 'demo123'})
    res = client.get('/api/dashboard')
    d = res.get_json().get('data', res.get_json())
    assert 'total_colleges' in d and 'total_users' in d
    print(f"  ✓ Super Admin Dashboard: Colleges={d['total_colleges']}, Total Users={d['total_users']}")

    # ---------------------------------------------------------
    # Scenario 14: Database Persistence After Restart
    # ---------------------------------------------------------
    print("\n--- Test Scenario 14: Database Persistence Verification ---")
    s = db_session()
    prob = s.query(Problem).filter_by(title=prob_title).first()
    assert prob is not None
    assert prob.points == 25
    print(f"  ✓ Record verified directly in SQLite database: '{prob.title}' with {prob.points} points")

    stu = s.query(Student).filter_by(student_code=f'STU_{t_stamp}_1').first()
    assert stu is not None
    assert stu.name == 'Arjun Reddy'
    print(f"  ✓ CSV imported student verified in SQLite: '{stu.name}' ({stu.student_code})")

    # ---------------------------------------------------------
    # Scenario 15: Theme and User Settings
    # ---------------------------------------------------------
    print("\n--- Test Scenario 15: Theme and User Settings ---")
    client.post('/api/login', json={'identifier': 'student@demo.com', 'password': 'demo123'})
    res = client.put('/api/settings', json={'theme': 'dark', 'daily_reminders': True})
    assert res.status_code == 200
    assert res.get_json()['settings']['theme'] == 'dark'

    res = client.get('/api/settings')
    assert res.get_json()['settings']['theme'] == 'dark'
    print("  ✓ Dark theme preference persisted to SQLite")

    client.put('/api/settings', json={'theme': 'light'})
    print("  ✓ Light theme restored")

    res = client.get('/')
    assert res.status_code == 200
    assert b'INOVATE SOLUTION TECHNOLOGY' in res.data
    assert b'heroCanvas' in res.data
    assert b'confettiCanvas' in res.data
    print("  ✓ Root route '/' renders index.html cleanly")

    # ---------------------------------------------------------
    # Scenario 16: Registration & Real-Time Access for All 4 Roles
    # ---------------------------------------------------------
    print("\n--- Test Scenario 16: Real-Time Registration & Access for All 4 Roles ---")
    reg_stamp = int(time.time())

    # 1. Register new Student
    reg_stu_client = app.test_client()
    res = reg_stu_client.post('/api/register', json={
        'name': f'New Student {reg_stamp}',
        'email': f'stu_{reg_stamp}@campus.edu',
        'password': 'password123',
        'role': 'student',
        'department': 'CSE',
        'batch': '2024-A'
    })
    assert res.status_code == 201, f"Student registration failed: {res.get_json()}"
    data = res.get_json()
    assert data['success'] is True
    assert data['user']['role'] == 'student'
    print(f"  ✓ Student registered & authenticated: {data['user']['name']} ({data['user']['roll_number']})")
    # Verify student workspace access
    dash_res = reg_stu_client.get('/api/dashboard')
    assert dash_res.status_code == 200
    print("  ✓ Student workspace and dashboard access verified")

    # 2. Register new Faculty
    reg_fac_client = app.test_client()
    res = reg_fac_client.post('/api/register', json={
        'name': f'Prof. Rao {reg_stamp}',
        'email': f'fac_{reg_stamp}@campus.edu',
        'password': 'password123',
        'role': 'faculty',
        'department': 'IT'
    })
    assert res.status_code == 201, f"Faculty registration failed: {res.get_json()}"
    data = res.get_json()
    assert data['success'] is True
    assert data['user']['role'] == 'faculty'
    print(f"  ✓ Faculty registered & authenticated: {data['user']['name']} ({data['user']['roll_number']})")
    # Verify faculty workspace access
    weak_res = reg_fac_client.get('/api/faculty/weak-students')
    assert weak_res.status_code == 200
    print("  ✓ Faculty workspace and management endpoints access verified")

    # 3. Register new College Admin
    reg_adm_client = app.test_client()
    res = reg_adm_client.post('/api/register', json={
        'name': f'Admin Dean {reg_stamp}',
        'email': f'adm_{reg_stamp}@campus.edu',
        'password': 'password123',
        'role': 'admin',
        'college': f'College Institute {reg_stamp}'
    })
    assert res.status_code == 201, f"Admin registration failed: {res.get_json()}"
    data = res.get_json()
    assert data['success'] is True
    assert data['user']['role'] == 'admin'
    print(f"  ✓ College Admin registered & authenticated: {data['user']['name']} ({data['user']['roll_number']})")
    # Verify college admin reports access
    rep_res = reg_adm_client.get('/api/admin/reports')
    assert rep_res.status_code == 200
    print("  ✓ College Admin workspace and institutional reports access verified")

    # 4. Register new Super Admin
    reg_sup_client = app.test_client()
    res = reg_sup_client.post('/api/register', json={
        'name': f'Chief Architect {reg_stamp}',
        'email': f'sup_{reg_stamp}@campus.edu',
        'password': 'password123',
        'role': 'super'
    })
    assert res.status_code == 201, f"Super admin registration failed: {res.get_json()}"
    data = res.get_json()
    assert data['success'] is True
    assert data['user']['role'] == 'super'
    print(f"  ✓ Super Admin registered & authenticated: {data['user']['name']} ({data['user']['roll_number']})")
    # Verify super admin system monitoring access
    sys_res = reg_sup_client.get('/api/admin/monitoring')
    assert sys_res.status_code == 200, f"Monitoring failed: {sys_res.get_json()}"
    print("  ✓ Super Admin workspace and platform monitoring access verified")

    # 5. Validation rejections
    dup_res = client.post('/api/register', json={
        'name': 'Duplicate Test',
        'email': f'stu_{reg_stamp}@campus.edu',
        'password': 'password123',
        'role': 'student'
    })
    assert dup_res.status_code == 409
    print("  ✓ Duplicate email registration rejected with 409 Conflict")

    short_res = client.post('/api/register', json={
        'name': 'Short Pass',
        'email': f'short_{reg_stamp}@campus.edu',
        'password': '12',
        'role': 'student'
    })
    assert short_res.status_code == 400
    print("  ✓ Short password rejected with 400 Bad Request")

    inv_role_res = client.post('/api/register', json={
        'name': 'Invalid Role',
        'email': f'inv_{reg_stamp}@campus.edu',
        'password': 'password123',
        'role': 'hacker'
    })
    assert inv_role_res.status_code == 400
    print("  ✓ Invalid role rejected with 400 Bad Request")

    print("\n==================================================")
    print("ALL 16 TEST SCENARIOS PASSED WITH 100% SUCCESS!")
    print("==================================================")

def cleanup_test_data():
    import sqlite3
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'codecampus.db')
    if not os.path.exists(db_path):
        return
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in c.fetchall()]

    permanent_emails = {
        'student@demo.com', 'faculty@demo.com', 'admin@demo.com', 'super@demo.com',
        'jamie@demo.com', 'sam@demo.com', 'taylor@demo.com', 'riya@demo.com',
        'noah@demo.com', 'jordan@demo.com', 'arun@demo.com', 'meena@demo.com',
        'iklkk', 'harinik@gmail.com', 'abisiva@gmail.com', 'shalini@gmail.com'
    }

    c.execute("SELECT id, email FROM users")
    all_users = c.fetchall()
    test_users = [u for u in all_users if u[1] not in permanent_emails]
    user_ids = [u[0] for u in test_users]

    if user_ids:
        placeholders = ','.join('?' * len(user_ids))
        c.execute(f"SELECT id FROM students WHERE user_id IN ({placeholders})", user_ids)
        student_ids = [r[0] for r in c.fetchall()]
        if student_ids:
            s_placeholders = ','.join('?' * len(student_ids))
            if 'leaderboard' in tables:
                c.execute(f"DELETE FROM leaderboard WHERE student_id IN ({s_placeholders})", student_ids)
            if 'submissions' in tables:
                c.execute(f"DELETE FROM submissions WHERE student_id IN ({s_placeholders})", student_ids)
            if 'test_attempts' in tables:
                c.execute(f"DELETE FROM test_attempts WHERE student_id IN ({s_placeholders})", student_ids)
            c.execute(f"DELETE FROM students WHERE id IN ({s_placeholders})", student_ids)

        if 'faculty' in tables:
            c.execute(f"DELETE FROM faculty WHERE user_id IN ({placeholders})", user_ids)
        if 'profiles' in tables:
            c.execute(f"DELETE FROM profiles WHERE user_id IN ({placeholders})", user_ids)
        if 'user_settings' in tables:
            c.execute(f"DELETE FROM user_settings WHERE user_id IN ({placeholders})", user_ids)
        c.execute(f"DELETE FROM users WHERE id IN ({placeholders})", user_ids)

    if 'faculty' in tables:
        c.execute("DELETE FROM faculty WHERE user_id NOT IN (SELECT id FROM users)")
    if 'students' in tables:
        c.execute("DELETE FROM students WHERE user_id NOT IN (SELECT id FROM users)")
    if 'profiles' in tables:
        c.execute("DELETE FROM profiles WHERE user_id NOT IN (SELECT id FROM users)")
    if 'user_settings' in tables:
        c.execute("DELETE FROM user_settings WHERE user_id NOT IN (SELECT id FROM users)")
    if 'leaderboard' in tables:
        c.execute("DELETE FROM leaderboard WHERE student_id NOT IN (SELECT id FROM students)")
    if 'submissions' in tables:
        c.execute("DELETE FROM submissions WHERE student_id NOT IN (SELECT id FROM students)")

    if 'problem_assignments' in tables:
        c.execute("DELETE FROM problem_assignments WHERE problem_id IN (SELECT id FROM problems WHERE title LIKE 'Unit Test Problem%')")
    if 'submissions' in tables:
        c.execute("DELETE FROM submissions WHERE problem_id IN (SELECT id FROM problems WHERE title LIKE 'Unit Test Problem%')")
    if 'problems' in tables:
        c.execute("DELETE FROM problems WHERE title LIKE 'Unit Test Problem%'")

    if 'test_questions' in tables:
        c.execute("DELETE FROM test_questions WHERE test_id IN (SELECT id FROM scheduled_tests WHERE title LIKE 'Unit Test Assessment%')")
    if 'scheduled_tests' in tables:
        c.execute("DELETE FROM scheduled_tests WHERE title LIKE 'Unit Test Assessment%'")

    conn.commit()
    conn.close()

if __name__ == '__main__':
    try:
        run_tests()
    finally:
        cleanup_test_data()

