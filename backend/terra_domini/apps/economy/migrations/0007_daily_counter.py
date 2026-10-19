# Idempotent (see terra_domini/utils/migration_ops.py). Prices that climb with each use in the day (2026-10-19).
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from terra_domini.utils.migration_ops import CreateModelIfMissing


class Migration(migrations.Migration):

    dependencies = [
        ("economy", "0006_lottery_land"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        CreateModelIfMissing(
            name="DailyCounter",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(max_length=20)),
                ("day", models.DateField(db_index=True)),
                ("count", models.IntegerField(default=0)),
                ("player", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="daily_counters", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "daily_counters", "unique_together": {("player", "kind", "day")}},
        ),
    ]
