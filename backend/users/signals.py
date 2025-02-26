from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.contrib.auth.models import User

@receiver(pre_save, sender=User)
def set_username_to_email(sender, instance, **kwargs):
    """
    Signal to automatically set username to email if not explicitly set
    """
    if not instance.username or instance.username == '':
        instance.username = instance.email 