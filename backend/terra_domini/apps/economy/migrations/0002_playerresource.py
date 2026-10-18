# Idempotent (see terra_domini/utils/migration_ops.py): safe on DBs that already have this table.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from terra_domini.utils.migration_ops import CreateModelIfMissing


class Migration(migrations.Migration):

    dependencies = [
        ("economy", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        CreateModelIfMissing(
            name="PlayerResource",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("resource_id", models.CharField(max_length=40)),
                ("amount", models.FloatField(default=0)),
                ("total_produced", models.FloatField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("player", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="resource_stock", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "player_resources", "unique_together": {("player", "resource_id")}},
        ),
    ]
