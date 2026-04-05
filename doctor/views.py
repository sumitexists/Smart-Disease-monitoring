import json
import os
from datetime import timedelta

from django.conf import settings
from django.db.models import Count
from django.utils import timezone
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from doctor.models import User, Area, Symptom, SymptomReport, Disease
from doctor.utils import send_dengue_alert_if_threshold_crossed

# ── NCR pincode data (loaded once at start-up) ────────────────────
_PINCODE_JSON_PATH = os.path.join(
    settings.BASE_DIR, "doctor", "static", "doctor", "data", "ncr_pincodes.json"
)
try:
    with open(_PINCODE_JSON_PATH, encoding="utf-8") as _f:
        NCR_PINCODES = json.load(_f)
except (FileNotFoundError, json.JSONDecodeError):
    NCR_PINCODES = {}

# ── Common data ──────────────────────────────────────────────────
SYMPTOMS = [
    {"key": "fever",            "label": "Fever",               "emoji": "🌡️"},
    {"key": "cough",            "label": "Cough",               "emoji": "🤧"},
    {"key": "cold",             "label": "Cold / Runny Nose",   "emoji": "🥶"},
    {"key": "headache",         "label": "Headache",            "emoji": "🤕"},
    {"key": "body_ache",        "label": "Body Ache",           "emoji": "💪"},
    {"key": "fatigue",          "label": "Fatigue",             "emoji": "😴"},
    {"key": "sore_throat",      "label": "Sore Throat",         "emoji": "🗣️"},
    {"key": "breathlessness",   "label": "Breathlessness",      "emoji": "😮‍💨"},
    {"key": "chest_pain",       "label": "Chest Pain",          "emoji": "💔"},
    {"key": "nausea",           "label": "Nausea",              "emoji": "🤢"},
    {"key": "vomiting",         "label": "Vomiting",            "emoji": "🤮"},
    {"key": "diarrhea",         "label": "Diarrhea",            "emoji": "🚽"},
    {"key": "skin_rash",        "label": "Skin Rash",           "emoji": "🔴"},
    {"key": "joint_pain",       "label": "Joint Pain",          "emoji": "🦵"},
    {"key": "loss_taste_smell", "label": "Loss of Taste/Smell", "emoji": "👃"},
    {"key": "dizziness",        "label": "Dizziness",           "emoji": "😵"},
    {"key": "abdominal_pain",   "label": "Abdominal Pain",      "emoji": "🫃"},
    {"key": "eye_irritation",   "label": "Eye Irritation",      "emoji": "👁️"},
]

SEVERITIES = [
    {"value": "mild",     "label": "Mild",     "emoji": "🟢"},
    {"value": "moderate", "label": "Moderate", "emoji": "🟡"},
    {"value": "severe",   "label": "Severe",   "emoji": "🔴"},
]


# ──────────────────────────── Home ────────────────────────────────
def home(request):
    outbreak_locations = (
        Area.objects.values("pincode", "area")
        .annotate(user_count=Count("symptomreport"))
        .order_by("-user_count", "pincode", "area")[:8]
    )

    context = {
        "outbreak_locations": outbreak_locations,
    }
    return render(request, "doctor/home.html", context)


# ──────────────────────────── Area Heatmap ─────────────────────────
def area_heatmap(request):
    valid_pincode_entries = {
        pin: details
        for pin, details in NCR_PINCODES.items()
        if pin.isdigit() and isinstance(details, dict)
    }

    pincode_choices = {
        pin: details.get("areas", [])
        for pin, details in valid_pincode_entries.items()
    }
    selected_pincode = request.GET.get("pincode", "").strip()
    selected_area = request.GET.get("area", "").strip()
    selected_city = ""
    using_registered_area = False
    location_required = False

    if selected_pincode and selected_area:
        valid_areas = pincode_choices.get(selected_pincode, [])
        if selected_area not in valid_areas:
            messages.error(request, "Selected pincode and area combination is invalid.")
            selected_pincode = ""
            selected_area = ""
            location_required = True
        else:
            selected_city = valid_pincode_entries.get(selected_pincode, {}).get("city", "")
    elif request.user.is_authenticated and request.user.area_id:
        selected_pincode = request.user.area.pincode
        selected_area = request.user.area.area
        selected_city = valid_pincode_entries.get(selected_pincode, {}).get("city", "")
        using_registered_area = True
    else:
        location_required = True

    rows = list(
        Area.objects.values("area", "pincode")
        .annotate(case_count=Count("symptomreport"))
        .order_by("-case_count", "pincode", "area")
    )

    max_case_count = max((row["case_count"] for row in rows), default=0)
    total_cases = sum(row["case_count"] for row in rows)
    active_areas = len(rows)

    for row in rows:
        pincode_data = valid_pincode_entries.get(row["pincode"], {})
        row["city"] = pincode_data.get("city", "NCR")
        row["district"] = pincode_data.get("district", "Delhi NCR")

        if max_case_count:
            row["intensity"] = int((row["case_count"] / max_case_count) * 100)
        else:
            row["intensity"] = 0

        row["heat_alpha"] = round((row["intensity"] / 100) * 0.7 + 0.08, 2)

        if row["case_count"] >= 6:
            row["risk_level"] = "high"
        elif row["case_count"] >= 3:
            row["risk_level"] = "medium"
        else:
            row["risk_level"] = "low"

    disease_labels = []
    disease_values = []
    trend_days = []
    disease_names_7d = []
    trend_data = {}
    selected_location_summary = None

    if selected_pincode and selected_area:
        selected_location_summary = f"{selected_area} ({selected_pincode})"
        
        # Get disease-wise counts for selected location
        disease_data = (
            SymptomReport.objects
            .filter(area__pincode=selected_pincode, area__area=selected_area)
            .values("diseases__name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        
        for disease in disease_data:
            disease_name = disease.get("diseases__name") or "No Disease Tagged"
            count = disease.get("count", 0)
            if disease_name:  # Only add if disease name exists
                disease_labels.append(disease_name)
                disease_values.append(count)
        
        # Get 7-day disease trend data
        today = timezone.now().date()
        all_diseases = Disease.objects.filter(
            symptomreport__area__pincode=selected_pincode,
            symptomreport__area__area=selected_area
        ).distinct()
        
        for day_offset in range(6, -1, -1):
            day = today - timedelta(days=day_offset)
            trend_days.append(day.strftime("%d %b"))
        
        for disease in all_diseases:
            disease_names_7d.append(disease.name)
            daily_counts = []
            
            for day_offset in range(6, -1, -1):
                day = today - timedelta(days=day_offset)
                count = SymptomReport.objects.filter(
                    area__pincode=selected_pincode,
                    area__area=selected_area,
                    diseases=disease,
                    created_at__date=day
                ).count()
                daily_counts.append(count)
            
            trend_data[disease.name] = daily_counts

    city_rows = []
    if selected_city:
        for row in rows:
            if row.get("city") == selected_city:
                city_rows.append(row)

    city_rows = sorted(city_rows, key=lambda item: item["case_count"], reverse=True)[:8]
    city_area_labels = [f"{row['area']} ({row['pincode']})" for row in city_rows]
    city_area_values = [row["case_count"] for row in city_rows]

    context = {
        "heatmap_rows": rows,
        "max_case_count": max_case_count,
        "total_cases": total_cases,
        "active_areas": active_areas,
        "pincode_details_map": valid_pincode_entries,
        "pincode_choices": pincode_choices,
        "pincode_list": sorted(pincode_choices.keys()),
        "selected_pincode": selected_pincode,
        "selected_area": selected_area,
        "selected_city": selected_city,
        "using_registered_area": using_registered_area,
        "location_required": location_required,
        "selected_location_summary": selected_location_summary,
        "disease_labels": disease_labels,
        "disease_values": disease_values,
        "trend_days": trend_days,
        "disease_names_7d": disease_names_7d,
        "trend_data": trend_data,
        "city_area_labels": city_area_labels,
        "city_area_values": city_area_values,
    }
    return render(request, "doctor/heatmap.html", context)


# ──────────────────────────── Register ────────────────────────────
def register_view(request):
    """Allow a new user to create an account."""
    if request.user.is_authenticated:
        return redirect("home")

    if request.method == "POST":
        username  = request.POST.get("username", "").strip()
        email     = request.POST.get("email", "").strip()
        password1 = request.POST.get("password1", "")
        password2 = request.POST.get("password2", "")
        pincode   = request.POST.get("pincode", "").strip()
        area      = request.POST.get("area", "").strip()

        error = None

        if not username or not email or not password1 or not password2:
            error = "All fields are required."
        elif password1 != password2:
            error = "Passwords do not match."
        elif len(password1) < 8:
            error = "Password must be at least 8 characters."
        elif not pincode or len(pincode) != 6 or not pincode.isdigit():
            error = "Please enter a valid 6-digit pincode."
        elif pincode not in NCR_PINCODES:
            error = (
                "🚫 This service is not available in your location yet. "
                "We will be available soon!"
            )
        elif not area:
            error = "Please select your area from the dropdown."
        elif User.objects.filter(username=username).exists():
            error = "Username is already taken."
        elif User.objects.filter(email=email).exists():
            error = "An account with this email already exists."

        if error:
            messages.error(request, error)
        else:
            area_obj, _ = Area.objects.get_or_create(pincode=pincode, area=area)
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password1,
                area=area_obj,
            )
            login(request, user)
            messages.success(request, f"Welcome, {username}! Your account has been created.")
            return redirect("home")

    return render(request, "doctor/register.html")


# ──────────────────────────── Login ───────────────────────────────
def login_view(request):
    """Authenticate an existing user."""
    if request.user.is_authenticated:
        return redirect("home")

    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")

        if not username or not password:
            messages.error(request, "Please fill in all fields.")
        else:
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                messages.success(request, f"Welcome back, {user.username}!")
                next_url = request.GET.get("next", "home")
                return redirect(next_url)
            else:
                messages.error(request, "Invalid username or password.")

    return render(request, "doctor/login.html")


# ──────────────────────────── Logout ──────────────────────────────
@login_required
def logout_view(request):
    """Log out the current user."""
    logout(request)
    messages.info(request, "You have been logged out.")
    return redirect("login")


# ──────────────────────────── Disease Trends ──────────────────────
@login_required
def disease_trends(request):
    """Display disease trends and analytics."""
    time_range = request.GET.get("range", "7")  # 7, 14, 30
    try:
        days = int(time_range)
    except ValueError:
        days = 7
    
    today = timezone.now().date()
    start_date = today - timedelta(days=days - 1)
    
    # Get all diseases
    diseases = Disease.objects.all().order_by("name")
    disease_list = list(diseases)
    
    # Build daily trend data for each disease
    trend_labels = []
    disease_trend_data = {}
    
    for disease in disease_list:
        disease_trend_data[disease.name] = []
    
    for day_offset in range(days - 1, -1, -1):
        current_date = today - timedelta(days=day_offset)
        trend_labels.append(current_date.strftime("%d %b"))
        
        for disease in disease_list:
            count = SymptomReport.objects.filter(
                diseases=disease,
                created_at__date=current_date
            ).count()
            disease_trend_data[disease.name].append(count)
    
    # Get top diseases (last 7 days)
    last_7_days = today - timedelta(days=6)
    top_diseases = (
        Disease.objects.filter(symptomreport__created_at__date__gte=last_7_days)
        .annotate(count=Count("symptomreport"))
        .order_by("-count")[:10]
    )
    
    top_disease_names = [d.name for d in top_diseases]
    top_disease_counts = [d.count for d in top_diseases]
    
    # Get disease by area distribution (last 7 days)
    area_disease_data = (
        SymptomReport.objects
        .filter(created_at__date__gte=last_7_days)
        .values("area__area", "area__pincode")
        .annotate(count=Count("id"))
        .order_by("-count")[:10]
    )
    
    area_labels = [f"{item['area__area']} ({item['area__pincode']})" for item in area_disease_data]
    area_counts = [item["count"] for item in area_disease_data]
    
    # Get severity distribution
    severity_data = (
        SymptomReport.objects
        .filter(created_at__date__gte=last_7_days)
        .values("severity")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    
    severity_labels = [item.get("severity", "Unknown") for item in severity_data]
    severity_counts = [item["count"] for item in severity_data]
    
    context = {
        "time_range": time_range,
        "trend_labels": trend_labels,
        "disease_trend_data": disease_trend_data,
        "disease_list": [d.name for d in disease_list][:10],  # Top 10 diseases
        "top_disease_names": top_disease_names,
        "top_disease_counts": top_disease_counts,
        "area_labels": area_labels,
        "area_counts": area_counts,
        "severity_labels": severity_labels,
        "severity_counts": severity_counts,
    }
    
    return render(request, "doctor/disease_trends.html", context)


# ──────────────────────────── Report Symptoms ─────────────────────
@login_required
def report_symptoms(request):
    """Login-required view: collect symptoms, pincode, and area."""
    selected_symptoms = []

    if request.method == "POST":
        selected_symptoms = request.POST.getlist("symptoms")
        other_symptoms    = request.POST.get("other_symptoms", "").strip()
        severity          = request.POST.get("severity", "").strip()
        pincode           = request.POST.get("pincode", "").strip()
        area              = request.POST.get("area", "").strip()

        # ── Validation ─────────────────────────────────────────
        errors = []

        if not selected_symptoms and not other_symptoms:
            errors.append("Please select at least one symptom.")
        if not pincode or len(pincode) != 6 or not pincode.isdigit():
            errors.append("Please enter a valid 6-digit pincode.")
        if not area:
            errors.append("Please select your area from the dropdown.")
        if not severity:
            errors.append("Please select a severity level.")

        if errors:
            for err in errors:
                messages.error(request, err)
        else:
            area_obj, _ = Area.objects.get_or_create(pincode=pincode, area=area)

            if request.user.area_id != area_obj.id:
                request.user.area = area_obj
                request.user.save(update_fields=["area"])

            report = SymptomReport.objects.create(
                user=request.user,
                area=area_obj,
                severity=severity,
                other_symptoms=other_symptoms,
            )

            symptom_name_by_key = {item["key"]: item["label"] for item in SYMPTOMS}
            symptom_objects = []

            for symptom_key in selected_symptoms:
                symptom_label = symptom_name_by_key.get(symptom_key, symptom_key.replace("_", " ").title())
                symptom_obj, _ = Symptom.objects.get_or_create(name=symptom_label)
                symptom_objects.append(symptom_obj)

            if other_symptoms:
                for custom_symptom in [part.strip() for part in other_symptoms.split(",") if part.strip()]:
                    symptom_obj, _ = Symptom.objects.get_or_create(name=custom_symptom[:100])
                    symptom_objects.append(symptom_obj)

            if symptom_objects:
                report.symptoms.set(symptom_objects)

            disease_rules = [
                ("Dengue", {"fever", "body_ache", "headache", "skin_rash"}),
                ("Flu", {"fever", "cough", "cold", "fatigue", "sore_throat"}),
                ("COVID-19", {"fever", "cough", "breathlessness", "loss_taste_smell"}),
            ]

            selected_key_set = set(selected_symptoms)
            matched_diseases = []
            for disease_name, required in disease_rules:
                overlap = len(selected_key_set.intersection(required))
                if overlap >= 2:
                    disease_obj, _ = Disease.objects.get_or_create(name=disease_name)
                    matched_diseases.append(disease_obj)

            if matched_diseases:
                report.diseases.set(matched_diseases)

            alert_sent, dengue_count = send_dengue_alert_if_threshold_crossed(area_obj)
            if alert_sent:
                messages.warning(
                    request,
                    (
                        f"Dengue alert email sent for {area_obj.area} ({area_obj.pincode}). "
                        f"Current dengue reports: {dengue_count}."
                    ),
                )

            messages.success(
                request,
                f"✅ Your symptom report for {area} ({pincode}) has been submitted. "
                "Thank you for helping track disease spread!"
            )
            return redirect("report_symptoms")

    context = {
        "symptoms":          SYMPTOMS,
        "severities":        SEVERITIES,
        "selected_symptoms": selected_symptoms,
    }
    return render(request, "doctor/report.html", context)

# ──────────────────────────── User Profile ────────────────────────
@login_required
def user_profile(request):
    """Display and allow user to edit their profile and location."""
    user = request.user
    current_area = user.area if user.area else None
    if current_area is None:
        latest_report = (
            SymptomReport.objects.filter(user=user)
            .select_related("area")
            .order_by("-created_at")
            .first()
        )
        if latest_report and latest_report.area_id:
            current_area = latest_report.area
            user.area = current_area
            user.save(update_fields=["area"])

    current_city = "-"
    if current_area:
        current_city = NCR_PINCODES.get(current_area.pincode, {}).get("city", "-")
    form_pincode = current_area.pincode if current_area else ""
    form_area = current_area.area if current_area else ""
    location_form_locked = True
    pincode_choices = NCR_PINCODES
    
    error = None
    success = None
    
    if request.method == "POST":
        action = request.POST.get("action", "").strip()
        
        if action == "update_location":
            pincode = request.POST.get("pincode", "").strip()
            area = request.POST.get("area", "").strip()
            form_pincode = pincode
            form_area = area
            location_form_locked = False
            
            if not pincode or len(pincode) != 6 or not pincode.isdigit():
                error = "Please enter a valid 6-digit pincode."
            elif pincode not in NCR_PINCODES:
                error = (
                    "🚫 This service is not available in your location yet. "
                    "We will be available soon!"
                )
            else:
                valid_areas = NCR_PINCODES.get(pincode, {}).get("areas", [])
                if area not in valid_areas:
                    error = "Selected area is not valid for this pincode."
                else:
                    area_obj, _ = Area.objects.get_or_create(
                        pincode=pincode,
                        area=area
                    )
                    user.area = area_obj
                    user.save()
                    current_area = area_obj
                    current_city = NCR_PINCODES.get(pincode, {}).get("city", "-")
                    form_pincode = pincode
                    form_area = area
                    location_form_locked = True
                    success = f"Location updated to {area} ({pincode})"
    
    # Get user's reported diseases
    user_reports = SymptomReport.objects.filter(user=user).order_by("-created_at")
    
    # Aggregate disease data
    disease_summary = {}
    for report in user_reports:
        for disease in report.diseases.all():
            if disease.name not in disease_summary:
                disease_summary[disease.name] = {
                    "count": 0,
                    "first_reported": report.created_at,
                    "last_reported": report.created_at,
                    "severity_levels": set()
                }
            disease_summary[disease.name]["count"] += 1
            disease_summary[disease.name]["last_reported"] = max(
                disease_summary[disease.name]["last_reported"],
                report.created_at
            )
            disease_summary[disease.name]["severity_levels"].add(report.severity)
    
    # Convert severity sets to lists for template
    for disease_name, data in disease_summary.items():
        data["severity_levels"] = sorted(list(data["severity_levels"]))
    
    context = {
        "user": user,
        "current_area": current_area,
        "current_city": current_city,
        "form_pincode": form_pincode,
        "form_area": form_area,
        "location_form_locked": location_form_locked,
        "pincode_choices": pincode_choices,
        "error": error,
        "success": success,
        "user_reports": user_reports[:20],
        "disease_summary": sorted(
            disease_summary.items(), 
            key=lambda x: x[1]["last_reported"], 
            reverse=True
        ),
        "total_reports": user_reports.count(),
        "unique_diseases": len(disease_summary),
    }
    
    return render(request, "doctor/profile.html", context)
