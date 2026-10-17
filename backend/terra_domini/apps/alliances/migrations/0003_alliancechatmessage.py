# Idempotent (see terra_domini/utils/migration_ops.py): safe on DBs that already have these tables/columns.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing, AddIndexIfMissing, CreateModelIfMissing  # noqa: F401


class Migration(migrations.Migration):

    dependencies = [
        ("alliances", "0002_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        CreateModelIfMissing(
            name="AllianceChatMessage",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "message_type",
                    models.CharField(
                        choices=[
                            ("chat", "Chat"),
                            ("help", "Help Request"),
                            ("attack_plan", "Attack Plan"),
                            ("system", "System"),
                        ],
                        default="chat",
                        max_length=20,
                    ),
                ),
                ("text", models.TextField(max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "alliance",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="chat_messages",
                        to="alliances.alliance",
                    ),
                ),
                (
                    "player",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "alliance_chat_messages",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["alliance", "-created_at"],
                        name="alliance_ch_allianc_2e2022_idx",
                    )
                ],
            },
        ),
    ]
