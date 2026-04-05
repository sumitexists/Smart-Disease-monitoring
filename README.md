# Smart Disease Monitoring

A Django-based web application for symptom reporting, disease trend visualization, area-level outbreak heatmapping, and automated dengue threshold alerts.

This project is designed around city/locality (pincode + area) intelligence, where users can:
- Register with location details
- Submit symptom reports with severity
- View area heat intensity and disease-specific trends
- Track personal report history from profile
- Receive dengue outbreak email alerts when threshold is crossed

---

## Table of Contents
1. Project Overview
2. Tech Stack
3. Core Features
4. Current Application Flow
5. Folder Structure
6. Data Model
7. URL Map
8. Setup and Run
9. Configuration
10. Email Alert System
11. Heatmap and Trend Logic
12. Profile and Location Logic
13. Common Commands
14. Troubleshooting
15. Security Notes
16. Future Improvements

---

## 1. Project Overview

Smart Disease Monitoring is a monolithic Django app (`doctor`) inside project `vihaan`.

It combines:
- Authentication
- Disease intelligence from symptom clusters
- Area-wise analytics
- Personalized profile and report history
- Operational alerts via email

The app uses SQLite by default and relies on static NCR pincode metadata from:
- `doctor/static/doctor/data/ncr_pincodes.json`

---

## 2. Tech Stack

- Backend: Django 6.0.3
- Language: Python 3.x
- Database: SQLite (`db.sqlite3`)
- Frontend: Django templates + Vanilla JS + custom CSS
- Charting: Native HTML5 Canvas rendering (no external chart package dependency)
- Email: SMTP via Django `EmailMessage`

---

## 3. Core Features

### 3.1 Authentication and User Onboarding
- User registration with:
  - username
  - email
  - password
  - pincode + area validation against NCR metadata
- Login/logout flows
- Custom user model (`doctor.User`) with optional location FK

### 3.2 Symptom Reporting
- Report includes:
  - selected symptoms
  - optional free-text symptoms
  - severity (`mild`, `moderate`, `severe`)
  - pincode and area
- Auto disease classification rule set currently includes:
  - Dengue
  - Flu
  - COVID-19
- Each report can map to multiple symptoms and diseases

### 3.3 Heatmap Dashboard
- Area-wise case load cards
- Relative intensity scoring (`intensity`, `heat_alpha`)
- Risk tiers:
  - low
  - medium
  - high
- Disease breakdown at selected location:
  - bar chart (disease counts)
  - pie chart (distribution)
  - 7-day disease trend chart
- City-level top affected areas comparison chart

### 3.4 Disease Trends Dashboard
- Time filters for `7`, `14`, `30` days
- Multi-line disease trend chart
- Top diseases chart
- Affected area chart
- Severity distribution chart
- Trends summary table

### 3.5 User Profile
- View account details
- View location summary
- Update location with strict pincode-area validation
- Form stays hidden until user clicks update button
- Prefill behavior:
  - from `user.area`
  - fallback from latest symptom report area if `user.area` is missing
- Personal disease history + recent reports table

### 3.6 Dengue Alert Engine
- Triggered after each report submission
- Counts dengue cases in area
- Sends email alert when area count exceeds configured threshold
- Uses BCC for privacy

---

## 4. Current Application Flow

### Register
1. User opens `/register/`
2. Enters credentials and location
3. Location validated against NCR pincode map
4. User created with location FK

### Report
1. User opens `/report/`
2. Selects symptoms and severity
3. Enters pincode/area
4. Report saved with linked `Area`, `Symptom`, `Disease`
5. Dengue threshold checker runs and may send alert

### Heatmap
1. User opens `/heatmap/`
2. Can use selected pincode+area or registered area fallback
3. App renders heat cards and charts for disease analytics

### Trends
1. User opens `/trends/`
2. Selects range (7/14/30)
3. Dashboard renders multi-chart disease intelligence

### Profile
1. User opens `/profile/`
2. Sees read-only location summary by default
3. Clicks update button to reveal editable form
4. Submits validated pincode+area update

---

## 5. Folder Structure

```text
Smart-Disease-monitoring/
├── manage.py
├── db.sqlite3
├── doctor/
│   ├── models.py
│   ├── views.py
│   ├── urls.py
│   ├── utils.py
│   ├── migrations/
│   ├── static/doctor/
│   │   ├── css/
│   │   ├── js/
│   │   └── data/ncr_pincodes.json
│   ├── templates/doctor/
│   │   ├── layout.html
│   │   ├── home.html
│   │   ├── register.html
│   │   ├── login.html
│   │   ├── report.html
│   │   ├── heatmap.html
│   │   ├── disease_trends.html
│   │   └── profile.html
│   └── templatetags/
└── vihaan/
    ├── settings.py
    ├── urls.py
    ├── asgi.py
    └── wsgi.py
```

---

## 6. Data Model

### `User` (custom auth model)
- Extends `AbstractUser`
- `area` -> FK to `Area` (nullable)

### `Area`
- `pincode` (CharField, 6)
- `area` (CharField)

### `Symptom`
- `name` (unique)

### `Disease`
- `name` (unique)

### `SymptomReport`
- `user` -> FK `User`
- `area` -> FK `Area`
- `severity` -> choices: mild/moderate/severe
- `other_symptoms` -> Text
- `symptoms` -> M2M `Symptom`
- `diseases` -> M2M `Disease`
- `created_at` -> auto timestamp

---

## 7. URL Map

From `doctor/urls.py`:
- `/` -> Home
- `/heatmap/` -> Area heatmap
- `/trends/` -> Disease trends dashboard
- `/profile/` -> User profile and location update
- `/register/` -> Register
- `/login/` -> Login
- `/logout/` -> Logout
- `/report/` -> Symptom report

---

## 8. Setup and Run

### 8.1 Clone and enter
```bash
git clone <your-repo-url>
cd Smart-Disease-monitoring
```

### 8.2 Create virtual environment
```bash
python -m venv .venv
source .venv/bin/activate
```

### 8.3 Install dependencies
If you have a requirements file:
```bash
pip install -r requirements.txt
```
If not, minimum required:
```bash
pip install django==6.0.3
```

### 8.4 Migrate database
```bash
python manage.py migrate
```

### 8.5 Create admin (optional)
```bash
python manage.py createsuperuser
```

### 8.6 Run server
```bash
python manage.py runserver
```

Open:
- `http://127.0.0.1:8000/`

---

## 9. Configuration

Key settings in `vihaan/settings.py`:
- `AUTH_USER_MODEL = 'doctor.User'`
- `LOGIN_URL`, `LOGIN_REDIRECT_URL`, `LOGOUT_REDIRECT_URL`
- SMTP settings (`EMAIL_*`)
- Alert settings:
  - `DENGUE_ALERT_THRESHOLD`
  - `DENGUE_ALERT_TEST_EMAIL`

---

## 10. Email Alert System

Implemented in `doctor/utils.py`:
- Function: `send_dengue_alert_if_threshold_crossed(area_obj)`

Behavior:
1. Count distinct dengue-tagged reports in area
2. If count <= threshold: no email
3. Build recipients from users mapped to area
4. Add test email if configured
5. Send email via SMTP using:
   - one visible `to` recipient
   - all others in `bcc`

---

## 11. Heatmap and Trend Logic

### Heatmap (`/heatmap/`)
- Calculates total area case counts
- Derives visual intensity score
- Assigns risk level by count thresholds
- Supports explicit query params `pincode` + `area`
- Falls back to registered user area

### Selected location analytics
- Disease count bar chart
- Disease distribution pie chart
- 7-day disease trend data (`trend_data` keyed by disease name)
- City comparison chart by top areas

---

## 12. Profile and Location Logic

In `user_profile` view:
- Resolve user location from:
  1. `user.area`
  2. latest user report area (fallback)
- Form prefilled with resolved location
- Form hidden by default
- Form appears only on update button click
- Validation aligns with register-time constraints

Unavailable pincode message is intentionally consistent with registration flow.

---

## 13. Common Commands

### Django system check
```bash
python manage.py check
```

### Run migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### Open Django shell
```bash
python manage.py shell
```

### Test alert manually (example)
```bash
python manage.py shell -c "from doctor.models import Area; from doctor.utils import send_dengue_alert_if_threshold_crossed; area = Area.objects.filter(pincode='201309').first(); print(send_dengue_alert_if_threshold_crossed(area))"
```

---

## 14. Troubleshooting

### Issue: Profile location not showing
- Ensure user has `area` set, or at least one report linked to an area.
- App now backfills from latest report if `user.area` is null.

### Issue: Area dropdown empty
- Confirm pincode exists in `ncr_pincodes.json`.
- Check pincode is exactly 6 numeric digits.

### Issue: No email delivered
- Verify SMTP host/port/TLS and credentials.
- Ensure sender account allows SMTP/app passwords.
- Check threshold logic (`DENGUE_ALERT_THRESHOLD`).

### Issue: Charts not rendering
- Ensure template JSON script blocks are present.
- Confirm relevant selected location data exists.
- Run `python manage.py check` for template syntax validity.

---

## 15. Security Notes

- Do not commit real SMTP credentials to public repositories.
- Rotate any credentials that were ever committed.
- For production, move secrets into environment variables.
- Set `DEBUG = False` and configure `ALLOWED_HOSTS`.
- Use HTTPS and secure cookie settings in production.

---

## 16. Future Improvements

- Add automated test suite for views/forms/business logic
- Add pagination and filtering for report history
- Add role-based access (admin/doctor/public health analyst)
- Add Celery/queue for async email alerts
- Add map API integration for geospatial visualization
- Add anomaly detection for sudden disease spikes
- Add API endpoints for mobile app integration

---

## Maintainer Notes

This README reflects the current implementation status in this repository at the time of writing.

If you change routes, models, or dashboards, update this README in the same PR/commit to keep onboarding smooth for collaborators.
