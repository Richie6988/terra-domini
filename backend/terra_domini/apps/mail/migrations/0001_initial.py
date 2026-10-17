# Idempotent (see terra_domini/utils/migration_ops.py): safe on DBs that already have these tables/columns.

from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing, AddIndexIfMissing, CreateModelIfMissing  # noqa: F401


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        CreateModelIfMissing(
            name="CaughtEmail",
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
                ("sender", models.EmailField(max_length=254)),
                ("recipients", models.TextField()),
                ("subject", models.CharField(blank=True, max_length=500)),
                ("body_text", models.TextField(blank=True)),
                ("body_html", models.TextField(blank=True)),
                ("raw", models.TextField(blank=True)),
                ("received_at", models.DateTimeField(auto_now_add=True)),
                ("read", models.BooleanField(default=False)),
            ],
            options={
                "ordering": ["-received_at"],
            },
        ),
    ]
