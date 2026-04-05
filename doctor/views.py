from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from doctor.models import User

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
    return render(request, "doctor/home.html")


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

        if not username or not email or not password1 or not password2:
            messages.error(request, "All fields are required.")
        elif password1 != password2:
            messages.error(request, "Passwords do not match.")
        elif len(password1) < 8:
            messages.error(request, "Password must be at least 8 characters.")
        elif User.objects.filter(username=username).exists():
            messages.error(request, "Username is already taken.")
        elif User.objects.filter(email=email).exists():
            messages.error(request, "An account with this email already exists.")
        else:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password1,
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
            # TODO: Save the report to the database (model not yet created)
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