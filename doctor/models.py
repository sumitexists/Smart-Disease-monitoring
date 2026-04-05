from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
   area = models.ForeignKey(
        'Area',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Area associated with the user, derived from pincode.",
        related_name="user_area"
    )

class Area(models.Model):
    """Model representing a locality or area in NCR."""

    pincode = models.CharField(
        max_length=6,
        blank=True,
        default="",
        help_text="6-digit NCR pincode of the user's location.",
    )
    area = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Locality / area derived from the pincode.",
    )

    def __str__(self):
        return f"{self.area}  - ({self.pincode})"
    

class Symptom(models.Model):
    """Model representing a medical symptom."""

    name = models.CharField(
        max_length=100, 
        unique=True
        )

    def __str__(self):
        return self.name
    
class SymptomReport(models.Model):
    SEVERITY_CHOICES = [
        ("mild", "Mild"),
        ("moderate", "Moderate"),
        ("severe", "Severe"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    area = models.ForeignKey(Area, on_delete=models.CASCADE)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    other_symptoms = models.TextField(blank=True, default="")
    symptoms = models.ManyToManyField(Symptom)

    diseases = models.ManyToManyField("Disease", blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return (
            f"{self.user.username} in {self.area} ({self.severity}) "
            f"reported on {self.created_at.strftime('%Y-%m-%d %H:%M:%S')}"
        )
    
class Disease(models.Model):
    """Model representing a disease confirmed by a doctor."""

    name = models.CharField(
        max_length=100, 
        unique=True
        )

    def __str__(self):
        return f"{self.name} confirmed"