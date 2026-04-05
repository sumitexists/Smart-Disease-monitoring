from django import template

register = template.Library()

@register.filter
def get_city(value, pincode):
    """Get city name from pincode_choices dictionary"""
    if not isinstance(value, dict) or not pincode:
        return "-"
    details = value.get(str(pincode), {})
    return details.get("city", "-")
