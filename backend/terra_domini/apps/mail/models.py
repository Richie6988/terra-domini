from django.db import models


class CaughtEmail(models.Model):
    """Email caught by the local SMTP server."""
    sender = models.EmailField()
    recipients = models.TextField()  # comma-separated
    subject = models.CharField(max_length=500, blank=True)
    body_text = models.TextField(blank=True)
    body_html = models.TextField(blank=True)
    raw = models.TextField(blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)

    class Meta:
        ordering = ['-received_at']

    def __str__(self):
        return f'{self.subject} → {self.recipients} ({self.received_at:%H:%M})'
