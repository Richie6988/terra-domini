from django.contrib import admin
from .models import CaughtEmail


@admin.register(CaughtEmail)
class CaughtEmailAdmin(admin.ModelAdmin):
    list_display = ['subject', 'sender', 'recipients', 'received_at', 'read']
    list_filter = ['read', 'received_at']
    search_fields = ['subject', 'sender', 'recipients', 'body_text']
    readonly_fields = ['sender', 'recipients', 'subject', 'body_text', 'body_html', 'raw', 'received_at']
    actions = ['mark_read']

    def mark_read(self, request, queryset):
        queryset.update(read=True)
    mark_read.short_description = 'Mark as read'
