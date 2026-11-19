# CodeCampus Full-Stack Web Application

A full-stack, enterprise-grade learning management and automated coding evaluation platform developed for **INOVATE SOLUTION TECHNOLOGY (IST)**.

CodeCampus connects a single-page frontend (HTML5, CSS3, JavaScript) to a robust **Flask** REST API backend backed by an isolated **SQLite** database and secure **sandboxed subprocess code execution**.

---

## 🚀 Key Features

### 1. Multi-Role Authentication & Access Control
- **Database-Driven Sessions**: Uses Flask server-side HTTP-only sessions backed by Werkzeug password hashing.
- **Four Distinct Workspaces**:
  - **Student**: Daily challenges, problem bank, topic practice, sandboxed code editor, submission history, competitive campus leaderboard, progress analytics.
  - **Faculty**: Student CRUD, problem assignments, scheduled test management, batch performance, intervention support plans for weak students, submission reports.
  - **College Admin**: Department management, cohort/batch management, student & faculty governance, bulk CSV import with validation, college reports.
  - **Super Admin**: Multi-tenant college management, user management, problem catalog management, licence renewals, system health monitoring.
- **Pre-Configured Demo Credentials**:
  | Role | Identifier | Password | Default Person |
  | :--- | :--- | :--- | :--- |
  | **Student** | `student@demo.com` (or `STU001`) | `demo123` | Alex Morgan |
  | **Faculty** | `faculty@demo.com` (or `FAC001`) | `demo123` | Dr. Priya Kumar |
  | **College Admin** | `admin@demo.com` | `demo123` | Karthik Raman |
  | **Super Admin** | `super@demo.com` | `demo123` | Platform Admin |

---

### 2. Isolated Sandboxed Code Execution
- **Zero In-Process Code Execution**: User code is **never** executed inside the main Flask application thread or process.
- **Subprocess Isolation**: Executed using dedicated sub-processes via Python `sys.executable -I -s` in isolated temporary directories with sanitized environment variables.
- **Resource Constraints**:
  - Execution timeout enforced at `4.0 seconds` (configurable in `config.py`).
  - Output length capped at `10,000 characters` to protect server memory.
  - Process cleanups guaranteed on termination.
- **Multi-Language Support**:
  - **Python 3** (verified and executing on host).
  - **Node.js / JavaScript** (detected and executed if installed).
  - **C / C++ / Java** (reports host compiler availability cleanly).

---

### 3. Preserved Frontend Aesthetics & Animations
- 100% of the original CSS design, layouts, typography, and color palettes preserved.
- Interactive hero canvas with mouse particle interactions on login.
- Sequential test-case step runner with visual checkmarks/crosses.
- Celebratory confetti physics canvas triggered on solution acceptance.
- Weekly activity bar charts with interactive hover tooltips.
- Gold/Silver/Bronze podium animations with crown gleam effects.
- Dark and Light themes persisted to SQLite per user.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.13+, Flask 3.1.3, Werkzeug 3.1.3
- **ORM / Database**: SQLAlchemy 2.0, SQLite 3 (WAL mode enabled)
- **Frontend**: HTML5, Vanilla JavaScript (ES6+ `fetch`), CSS3 custom properties
- **Execution Sandbox**: Subprocess with temporary directory isolation and timeout enforcement

---

## 📁 Project Structure

```
CodeCampus/
├── app.py                      # Flask application factory and route registration
├── config.py                   # Central configuration (DB path, timeouts, session cookies)
├── database.py                 # SQLAlchemy session management and automatic seed script
├── models.py                   # 16 Relational SQLite models with serialization
├── requirements.txt            # Python dependencies
├── README.md                   # System documentation and execution guide
│
├── instance/
│   └── codecampus.db           # SQLite persistent database file
│
├── routes/
│   ├── auth.py                 # /api/login, /api/logout, /api/session
│   ├── dashboard.py            # /api/dashboard (role-tailored analytics)
│   ├── students.py             # /api/students, /api/students/bulk-import
│   ├── faculty.py              # /api/faculty, /api/faculty/weak-students, support plans
│   ├── problems.py             # /api/problems, /api/problems/daily, /api/topics
│   ├── assignments.py          # /api/assignments
│   ├── submissions.py          # /api/submissions, /api/code/run (sandbox)
│   ├── tests.py                # /api/tests, /api/tests/<id>/submit (auto-grading)
│   ├── leaderboard.py          # /api/leaderboard, /api/leaderboard/kudos
│   ├── profile.py              # /api/profile
│   ├── settings.py             # /api/settings (theme & notifications)
│   └── admin.py                # /api/colleges, /api/departments, /api/batches, monitoring
│
├── services/
│   ├── authentication.py       # Session helpers, @login_required, @role_required
│   ├── code_execution.py       # Isolated subprocess sandbox runner & test case evaluator
│   └── analytics.py            # Dynamic statistics calculation from database
│
├── templates/
│   └── index.html              # Single page application template
│
└── static/
    ├── css/
    │   └── style.css           # Preserved visual styles and animation keyframes
    └── js/
        └── app.js              # Client controller connected to Flask REST APIs
```

---

## ⚙️ Installation & Running Locally

### Step 1: Install Dependencies
Open a terminal in the project directory and install the requirements:

```bash
pip install -r requirements.txt
```

### Step 2: Initialize Database and Start Flask Server
Run the application:

```bash
python app.py
```

On initial startup, `database.py` automatically initializes `instance/codecampus.db` and seeds:
- 12 verified users with hashed passwords
- 8 coding challenges with starter codes and test cases
- 3 academic departments and batches
- 3 colleges
- Sample submissions, assessments, and progress records

### Step 3: Open in Browser
Open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 🧪 Automated Test Verification

A test suite verifying all 15 scenarios specified in Section 13 is included. To run it:

```bash
python -c "import sys; sys.path.insert(0, '.'); from scratch.test_all_scenarios import run_tests; run_tests()"
```

### Verified Test Scenarios:
1. ✅ **Valid login** for all 4 roles (`student`, `faculty`, `admin`, `super`).
2. ✅ **Invalid login** rejected with HTTP 401.
3. ✅ **Logout & session expiration** verified.
4. ✅ **Role-based access restrictions** enforced (HTTP 403 on unauthorized routes).
5. ✅ **Student CRUD operations** with SQLite verification.
6. ✅ **Faculty CRUD operations** with SQLite verification.
7. ✅ **Problem creation and batch assignment**.
8. ✅ **Sandboxed code execution and test case evaluation** via subprocess.
9. ✅ **Scheduled test creation and student test submission** with automated grading.
10. ✅ **Dynamic leaderboard calculations** based on actual scores.
11. ✅ **Profile updates** persisted in SQLite.
12. ✅ **Bulk CSV student import** with header validation.
13. ✅ **Dashboard statistics** calculated dynamically from database records.
14. ✅ **Database persistence** verified directly in SQLite tables.
15. ✅ **Theme and appearance settings** persisted across sessions.

---

## 🔒 Security Notes

- **Password Storage**: Passwords are saved as PBKDF2/SHA-256 hashes generated by Werkzeug.
- **Session Security**: Cookies are configured with `HttpOnly=True` and `SameSite='Lax'` to protect against XSS and CSRF attacks.
- **Code Execution**: User scripts run in isolated subprocesses with a 4.0-second timeout, memory buffer limits, and sanitized environment variables.
