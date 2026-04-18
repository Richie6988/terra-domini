"""GM models — ticker messages and player feedback."""
import uuid
from django.db import models
from django.conf import settings


class TickerMessage(models.Model):
    """News ticker messages controlled by admin."""
    TYPE_CHOICES = [
        ('update', 'Update'), ('event', 'Event'), ('season', 'Season'),
        ('maintenance', 'Maintenance'), ('community', 'Community'),
        ('alert', 'Alert'), ('promo', 'Promo'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='update')
    title = models.CharField(max_length=100)
    text = models.CharField(max_length=500)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class PlayerFeedback(models.Model):
    """Player feedback / bug reports / suggestions."""
    STATUS_CHOICES = [
        ('pending', 'Pending'), ('replied', 'Replied'),
        ('resolved', 'Resolved'), ('rejected', 'Rejected'),
    ]
    CATEGORY_CHOICES = [
        ('bug', 'Bug'), ('suggestion', 'Suggestion'),
        ('complaint', 'Complaint'), ('other', 'Other'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='feedbacks')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_reply = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
