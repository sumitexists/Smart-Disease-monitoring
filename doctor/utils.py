from django.conf import settings
from django.core.mail import EmailMessage

from doctor.models import SymptomReport, User


def send_dengue_alert_if_threshold_crossed(area_obj):
	"""Send outbreak email when dengue reports in an area cross threshold."""
	threshold = getattr(settings, "DENGUE_ALERT_THRESHOLD", 10)
	test_email = getattr(settings, "DENGUE_ALERT_TEST_EMAIL", "").strip()

	dengue_count = SymptomReport.objects.filter(
		area=area_obj,
		diseases__name__iexact="Dengue",
	).distinct().count()

	if dengue_count <= threshold:
		return False, dengue_count

	recipients = list(
		User.objects.filter(area=area_obj)
		.exclude(email="")
		.values_list("email", flat=True)
		.distinct()
	)

	if test_email and test_email not in recipients:
		recipients.append(test_email)

	if not recipients:
		return False, dengue_count

	visible_to = [test_email] if test_email else [recipients[0]]
	bcc_recipients = [email for email in recipients if email not in visible_to]

	subject = f"Dengue Alert: {area_obj.area} ({area_obj.pincode})"
	message = (
		f"Health alert for {area_obj.area} ({area_obj.pincode}).\n\n"
		f"Detected dengue reports: {dengue_count}\n"
		f"Alert threshold: {threshold}\n\n"
		"Please take precautions: avoid mosquito breeding around your home, "
		"use repellents, and consult a doctor if symptoms worsen."
	)

	email_message = EmailMessage(
		subject=subject,
		body=message,
		from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
		to=visible_to,
		bcc=bcc_recipients,
	)
	email_message.send(fail_silently=False)
	return True, dengue_count
