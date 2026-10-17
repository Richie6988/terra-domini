# Idempotent (see terra_domini/utils/migration_ops.py): safe on DBs that already have these tables/columns.

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing, AddIndexIfMissing, CreateModelIfMissing  # noqa: F401


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        CreateModelIfMissing(
            name="PlayerFeedback",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("bug", "Bug"),
                            ("suggestion", "Suggestion"),
                            ("complaint", "Complaint"),
                            ("other", "Other"),
                        ],
                        default="other",
                        max_length=20,
                    ),
                ),
                ("message", models.TextField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("replied", "Replied"),
                            ("resolved", "Resolved"),
                            ("rejected", "Rejected"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("admin_reply", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "player",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="feedbacks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        CreateModelIfMissing(
            name="TickerMessage",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "type",
                    models.CharField(
                        choices=[
                            ("update", "Update"),
                            ("event", "Event"),
                            ("season", "Season"),
                            ("maintenance", "Maintenance"),
                            ("community", "Community"),
                            ("alert", "Alert"),
                            ("promo", "Promo"),
                        ],
                        default="update",
                        max_length=20,
                    ),
                ),
                ("title", models.CharField(max_length=100)),
                ("text", models.CharField(max_length=500)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
