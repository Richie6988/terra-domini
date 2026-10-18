# Idempotent (see terra_domini/utils/migration_ops.py). HEX coins picked up on the map (2026-10-18).
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from terra_domini.utils.migration_ops import CreateModelIfMissing


class Migration(migrations.Migration):

    dependencies = [
        ("economy", "0004_lottery"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        CreateModelIfMissing(
            name="PickupClaim",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("h3_index", models.CharField(max_length=20)),
                ("day", models.DateField(db_index=True)),
                ("amount", models.IntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("player", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pickups", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "pickup_claims", "unique_together": {("player", "h3_index", "day")}},
        ),
    ]
