"""
verify_admin — Auto-verify all superuser/staff accounts.
Usage: python manage.py verify_admin
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Mark all superuser/staff accounts as email_verified=True'

    def handle(self, *args, **options):
        from terra_domini.apps.accounts.models import Player
        updated = Player.objects.filter(
            is_staff=True
        ).update(email_verified=True)
        self.stdout.write(self.style.SUCCESS(f'Verified {updated} admin/staff accounts.'))
