import os
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from werkzeug.security import generate_password_hash
from config import Config
from models import (
    Base, College, Department, Batch, User, Student, Faculty, Problem,
    ProblemAssignment, Submission, ScheduledTest, TestQuestion, TestResult,
    Leaderboard, StudentProgress, Profile, UserSetting
)

engine = create_engine(
    Config.SQLALCHEMY_DATABASE_URI,
    connect_args={"check_same_thread": False}
)

db_session = scoped_session(
    sessionmaker(autocommit=False, autoflush=False, bind=engine)
)

def get_db():
    return db_session

def init_db():
    Base.metadata.create_all(bind=engine)
    session = db_session()
    
    # Check if database is already seeded
    if session.query(User).first() is not None:
        session.close()
        return

    print("Initializing and seeding database...")

    # 1. Colleges
    c1 = College(name='ABC Engineering College', location='Madurai', status='Active', licence_expiry='2027-06-30')
    c2 = College(name='City Institute of Technology', location='Chennai', status='Active', licence_expiry='2027-03-31')
    c3 = College(name='Greenfield College of Tech', location='Coimbatore', status='Pending', licence_expiry='2026-12-31')
    session.add_all([c1, c2, c3])
    session.flush()

    # 2. Departments
    d1 = Department(code='D01', name='Computer Science and Engineering', short_code='CSE', details='CSE · 240 Students', status='Active', college_id=c1.id)
    d2 = Department(code='D02', name='Information Technology', short_code='IT', details='IT · 180 Students', status='Active', college_id=c1.id)
    d3 = Department(code='D03', name='Electronics and Communication', short_code='ECE', details='ECE · 160 Students', status='Active', college_id=c1.id)
    session.add_all([d1, d2, d3])
    session.flush()

    # 3. Batches
    b1 = Batch(name='2024-A', department_id=d1.id, department_code='CSE', year='2024', student_count=48, details='48 students', status='Active')
    b2 = Batch(name='2024-B', department_id=d2.id, department_code='IT', year='2024', student_count=42, details='42 students', status='Active')
    b3 = Batch(name='2025-A', department_id=d3.id, department_code='ECE', year='2025', student_count=50, details='50 students', status='Active')
    session.add_all([b1, b2, b3])
    session.flush()

    # 4. Problems
    two_sum_tests = [
        {"input": "[2, 7, 11, 15], 9", "expected": "[0, 1]"},
        {"input": "[3, 2, 4], 6", "expected": "[1, 2]"},
        {"input": "[3, 3], 6", "expected": "[0, 1]"},
        {"input": "[-1, -2, -3, -4, -5], -8", "expected": "[2, 4]"},
        {"input": "[0, 4, 3, 0], 0", "expected": "[0, 3]"}
    ]

    missing_num_tests = [
        {"input": "[3, 0, 1]", "expected": "2"},
        {"input": "[0, 1]", "expected": "2"},
        {"input": "[9,6,4,2,3,5,7,0,1]", "expected": "8"},
        {"input": "[0]", "expected": "1"},
        {"input": "[1]", "expected": "0"}
    ]

    reverse_str_tests = [
        {"input": "'hello'", "expected": "'olleh'"},
        {"input": "'Hannah'", "expected": "'hannaH'"},
        {"input": "'a'", "expected": "'a'"},
        {"input": "''", "expected": "''"},
        {"input": "'racecar'", "expected": "'racecar'"}
    ]

    p1 = Problem(
        title='Two Sum',
        difficulty='Easy',
        topic='Arrays',
        points=20,
        description='Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution.',
        sample_input='nums = [2, 7, 11, 15], target = 9',
        sample_output='[0, 1]',
        starter_code_py="""def solution(nums, target):
    # Write your code here
    pass""",
        starter_code_java="""public class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your code here
        return new int[0];
    }
}""",
        starter_code_c="""int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    // Write your code here
    *returnSize = 0;
    return NULL;
}""",
        starter_code_cpp="""class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your code here
        return {};
    }
};""",
        starter_code_js="""function twoSum(nums, target) {
    // Write your code here
}""",
        test_cases_json=json.dumps(two_sum_tests),
        is_daily=False
    )

    p2 = Problem(
        title='Find the Missing Number',
        difficulty='Easy',
        topic='Arrays',
        points=20,
        description='You are given an array containing n distinct numbers in the range 0 to n. Return the only number in the range that is missing from the array.',
        sample_input='nums = [3, 0, 1]',
        sample_output='2',
        starter_code_py="""def solution(nums):
    # Write your code here
    pass""",
        test_cases_json=json.dumps(missing_num_tests),
        is_daily=True
    )

    p3 = Problem(
        title='Reverse a String',
        difficulty='Easy',
        topic='Strings',
        points=15,
        description='Write a function that reverses a string. The input string is given as an array of characters or string.',
        sample_input='s = "hello"',
        sample_output='"olleh"',
        starter_code_py="""def solution(s):
    # Write your code here
    pass""",
        test_cases_json=json.dumps(reverse_str_tests),
        is_daily=False
    )

    p4 = Problem(
        title='Maximum Subarray',
        difficulty='Medium',
        topic='Arrays',
        points=30,
        description='Given an integer array nums, find the subarray with the largest sum, and return its sum.',
        sample_input='nums = [-2,1,-3,4,-1,2,1,-5,4]',
        sample_output='6',
        starter_code_py="""def solution(nums):
    # Write your code here
    pass""",
        test_cases_json='[]',
        is_daily=False
    )

    p5 = Problem(
        title='Valid Parentheses',
        difficulty='Medium',
        topic='Data Structures',
        points=25,
        description='Given a string s containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid.',
        sample_input='s = "()[]{}"',
        sample_output='true',
        starter_code_py="""def solution(s):
    # Write your code here
    pass""",
        test_cases_json='[]',
        is_daily=False
    )

    p6 = Problem(
        title='Binary Search',
        difficulty='Easy',
        topic='Searching',
        points=20,
        description='Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.',
        sample_input='nums = [-1,0,3,5,9,12], target = 9',
        sample_output='4',
        starter_code_py="""def solution(nums, target):
    # Write your code here
    pass""",
        test_cases_json='[]',
        is_daily=False
    )

    p7 = Problem(
        title='Merge Two Sorted Lists',
        difficulty='Easy',
        topic='Data Structures',
        points=25,
        description='You are given the heads of two sorted linked lists list1 and list2. Merge the two lists into one sorted list and return its head.',
        sample_input='list1 = [1,2,4], list2 = [1,3,4]',
        sample_output='[1,1,2,3,4,4]',
        starter_code_py="""def solution(l1, l2):
    # Write your code here
    pass""",
        test_cases_json='[]',
        is_daily=False
    )

    p8 = Problem(
        title='Longest Substring Without Repeating Characters',
        difficulty='Medium',
        topic='Strings',
        points=35,
        description='Given a string s, find the length of the longest substring without duplicate characters.',
        sample_input='s = "abcabcbb"',
        sample_output='3',
        starter_code_py="""def solution(s):
    # Write your code here
    pass""",
        test_cases_json='[]',
        is_daily=False
    )

    session.add_all([p1, p2, p3, p4, p5, p6, p7, p8])
    session.flush()

    # 5. Core Users (with secure password hashing)
    hashed_pwd = generate_password_hash('demo123')

    # Student User: Alex Morgan
    u_student = User(
        email='student@demo.com',
        roll_number='STU001',
        password_hash=hashed_pwd,
        role='student',
        name='Alex Morgan'
    )
    session.add(u_student)
    session.flush()

    s_alex = Student(
        user_id=u_student.id,
        student_code='STU001',
        name='Alex Morgan',
        email='student@demo.com',
        department='CSE',
        batch='2024-A',
        details='CSE · A',
        score='86%',
        status='Active',
        points=420,
        solved_count=18,
        streak_days=6,
        college_id=c1.id
    )
    session.add(s_alex)
    session.flush()

    prof_alex = Profile(
        user_id=u_student.id,
        full_name='Alex Morgan',
        email='student@demo.com',
        roll_number='STU001',
        department='Computer Science and Engineering',
        batch='2024 - 2028 · Section A',
        college='ABC Engineering College',
        bio='Passionate about competitive programming, algorithms and full-stack engineering.'
    )
    sett_alex = UserSetting(
        user_id=u_student.id,
        theme='light',
        email_notifications=True,
        daily_reminders=True,
        weekly_summary=False
    )
    session.add_all([prof_alex, sett_alex])

    # Faculty User: Dr. Priya Kumar
    u_faculty = User(
        email='faculty@demo.com',
        roll_number='FAC001',
        password_hash=hashed_pwd,
        role='faculty',
        name='Dr. Priya Kumar'
    )
    session.add(u_faculty)
    session.flush()

    f_priya = Faculty(
        user_id=u_faculty.id,
        faculty_code='FAC001',
        name='Dr. Priya Kumar',
        email='faculty@demo.com',
        department='CSE',
        details='CSE · Head of Dept',
        status='Active',
        college_id=c1.id
    )
    prof_priya = Profile(
        user_id=u_faculty.id,
        full_name='Dr. Priya Kumar',
        email='faculty@demo.com',
        roll_number='FAC001',
        department='Computer Science and Engineering',
        batch='Faculty Department Head',
        college='ABC Engineering College',
        bio='Professor of Computer Science specializing in Algorithms and Distributed Computing.'
    )
    sett_priya = UserSetting(user_id=u_faculty.id, theme='light', email_notifications=True, daily_reminders=True)
    session.add_all([f_priya, prof_priya, sett_priya])

    # College Admin User: Karthik Raman
    u_admin = User(
        email='admin@demo.com',
        password_hash=hashed_pwd,
        role='admin',
        name='Karthik Raman'
    )
    session.add(u_admin)
    session.flush()

    prof_admin = Profile(
        user_id=u_admin.id,
        full_name='Karthik Raman',
        email='admin@demo.com',
        roll_number='ADM001',
        department='Institutional Administration',
        batch='Campus Operations',
        college='ABC Engineering College',
        bio='Institutional Administrator managing campus departments, batches and faculties.'
    )
    sett_admin = UserSetting(user_id=u_admin.id, theme='light', email_notifications=True, daily_reminders=False)
    session.add_all([prof_admin, sett_admin])

    # Super Admin User: Platform Admin
    u_super = User(
        email='super@demo.com',
        password_hash=hashed_pwd,
        role='super',
        name='Platform Admin'
    )
    session.add(u_super)
    session.flush()

    prof_super = Profile(
        user_id=u_super.id,
        full_name='Platform Admin',
        email='super@demo.com',
        roll_number='SA001',
        department='Global Operations',
        batch='HQ Systems',
        college='Inovate Solution Technology',
        bio='Global Super Administrator for CodeCampus Platform.'
    )
    sett_super = UserSetting(user_id=u_super.id, theme='light', email_notifications=True, daily_reminders=True)
    session.add_all([prof_super, sett_super])

    # 6. Additional Students (for Management, Weak Students, and Leaderboard)
    roster_students = [
        ('STU002', 'Jamie Lee', 'jamie@demo.com', 'IT', '2024-A', 'IT · A', '76%', 'Active', 920, 38, 5),
        ('STU003', 'Sam Wilson', 'sam@demo.com', 'CSE', '2024-B', 'CSE · B', '42%', 'Needs support', 540, 21, 3),
        ('STU004', 'Taylor Kim', 'taylor@demo.com', 'ECE', '2025-A', 'ECE · A', '91%', 'Active', 680, 29, 7),
        ('STU005', 'Riya Patel', 'riya@demo.com', 'IT', '2024-B', 'IT · B', '48%', 'Needs support', 480, 19, 2),
        ('STU006', 'Noah Davis', 'noah@demo.com', 'CSE', '2024-A', 'CSE · A', '51%', 'Needs support', 510, 20, 4),
        ('STU007', 'Jordan Smith', 'jordan@demo.com', 'CSE', '2024-A', 'CSE · A', '95%', 'Active', 1080, 42, 12)
    ]

    student_objs = [s_alex]
    for code, name, email, dept, batch, det, sc, st, pts, sol, strk in roster_students:
        u_temp = User(
            email=email,
            roll_number=code,
            password_hash=hashed_pwd,
            role='student',
            name=name
        )
        session.add(u_temp)
        session.flush()

        s_temp = Student(
            user_id=u_temp.id,
            student_code=code,
            name=name,
            email=email,
            department=dept,
            batch=batch,
            details=det,
            score=sc,
            status=st,
            points=pts,
            solved_count=sol,
            streak_days=strk,
            college_id=c1.id,
            support_plan='Assigned basic array & loop foundation exercises with mentor check-in.' if st == 'Needs support' else None,
            support_plan_date='2026-11-20' if st == 'Needs support' else None
        )
        session.add(s_temp)
        session.flush()

        p_temp = Profile(user_id=u_temp.id, full_name=name, email=email, roll_number=code, department=dept, batch=batch, college='ABC Engineering College')
        set_temp = UserSetting(user_id=u_temp.id, theme='light')
        session.add_all([p_temp, set_temp])
        student_objs.append(s_temp)

    # 7. Additional Faculty
    f2_user = User(email='arun@demo.com', roll_number='FAC002', password_hash=hashed_pwd, role='faculty', name='Prof. Arun Das')
    session.add(f2_user)
    session.flush()
    f2 = Faculty(user_id=f2_user.id, faculty_code='FAC002', name='Prof. Arun Das', email='arun@demo.com', department='IT', details='IT · Data Structures', status='Active', college_id=c1.id)

    f3_user = User(email='meena@demo.com', roll_number='FAC003', password_hash=hashed_pwd, role='faculty', name='Prof. Meena S')
    session.add(f3_user)
    session.flush()
    f3 = Faculty(user_id=f3_user.id, faculty_code='FAC003', name='Prof. Meena S', email='meena@demo.com', department='ECE', details='ECE · Algorithms', status='Active', college_id=c1.id)

    session.add_all([f2, f3])
    session.flush()

    # 8. Leaderboard Entries (Sorted by points)
    sorted_students = sorted(student_objs, key=lambda x: x.points, reverse=True)
    for idx, s in enumerate(sorted_students, 1):
        lb = Leaderboard(
            student_id=s.id,
            rank=idx,
            points=s.points,
            solved_count=s.solved_count,
            streak_days=s.streak_days,
            kudos_count=max(0, 10 - idx * 2)
        )
        session.add(lb)

    # 9. Topic Progress for Alex
    topics_list = [
        ('Arrays', 14, 18, 78),
        ('Strings', 9, 14, 65),
        ('Loops', 11, 12, 92),
        ('Functions', 5, 10, 48),
        ('Recursion', 2, 8, 25),
        ('Sorting', 3, 9, 35),
        ('Searching', 3, 8, 35),
        ('Data Structures', 8, 16, 52),
        ('Algorithms', 8, 20, 40)
    ]
    for top, sol, tot, mast in topics_list:
        prog = StudentProgress(
            student_id=s_alex.id,
            topic=top,
            problems_solved=sol,
            total_problems=tot,
            mastery_percentage=mast
        )
        session.add(prog)

    # 10. Initial Submissions for Alex
    sub1 = Submission(
        user_id=u_student.id,
        student_id=s_alex.id,
        problem_id=p1.id,
        problem_title='Two Sum',
        language='Python 3',
        code="""def solution(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []""",
        verdict='Accepted',
        score=20,
        runtime='0.02s',
        memory='12.4 MB',
        test_cases_passed=5,
        total_test_cases=5,
        output_log='[0, 1]\nAll 5 test cases passed.'
    )
    sub2 = Submission(
        user_id=u_student.id,
        student_id=s_alex.id,
        problem_id=p3.id,
        problem_title='Reverse a String',
        language='Java',
        code='// Java submission',
        verdict='Accepted',
        score=15,
        runtime='0.03s',
        memory='14.1 MB',
        test_cases_passed=5,
        total_test_cases=5,
        output_log='All 5 test cases passed.'
    )
    sub3 = Submission(
        user_id=u_student.id,
        student_id=s_alex.id,
        problem_id=p4.id,
        problem_title='Maximum Subarray',
        language='Python 3',
        code='// Python sub',
        verdict='Wrong Answer',
        score=0,
        runtime='0.04s',
        memory='12.8 MB',
        test_cases_passed=2,
        total_test_cases=5,
        output_log='Test case 3 failed.'
    )
    session.add_all([sub1, sub2, sub3])

    # 11. Problem Assignments
    pa1 = ProblemAssignment(
        problem_id=p1.id,
        assigned_by=u_faculty.id,
        batch_name='CSE · 2024-A (48 students)',
        due_date='2026-11-25',
        instructions='Complete the two-pointer or hash map approach and pass all 5 test cases.',
        status='Active'
    )
    pa2 = ProblemAssignment(
        problem_id=p5.id,
        assigned_by=u_faculty.id,
        batch_name='IT · 2024-A (42 students)',
        due_date='2026-11-28',
        instructions='Implement stack-based parentheses matching.',
        status='Active'
    )
    session.add_all([pa1, pa2])

    # 12. Scheduled Test with Questions
    test1 = ScheduledTest(
        title='Python Fundamentals',
        scheduled_date='2026-11-20',
        duration_minutes=60,
        question_count=1,
        status='Active',
        created_by=u_faculty.id
    )
    session.add(test1)
    session.flush()

    q1 = TestQuestion(
        test_id=test1.id,
        question_number=1,
        question_text='What is the output of print(2 ** 3)?',
        options_json=json.dumps(['6', '8', '9', '16']),
        correct_answer='8',
        points=10
    )
    session.add(q1)

    session.commit()
    session.close()
    print("Database initialized with seed data successfully!")
