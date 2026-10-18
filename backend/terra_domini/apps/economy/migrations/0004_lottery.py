# Idempotent (see terra_domini/utils/migration_ops.py). Lucky draw: jackpot pool + tickets (2026-10-18).
import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from terra_domini.utils.migration_ops import CreateModelIfMissing


class Migration(migrations.Migration):

    dependencies = [
        ("economy", "0003_daily_auctions"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        CreateModelIfMissing(
            name="LotteryPool",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.IntegerField(default=10000)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "lottery_pool"},
        ),
        CreateModelIfMissing(
            name="LotteryTicket",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tier", models.CharField(max_length=10)),
                ("cost", models.IntegerField()),
                ("multiplier", models.FloatField(default=0)),
                ("prize", models.IntegerField(default=0)),
                ("jackpot", models.BooleanField(default=False)),
                ("free", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("player", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lottery_tickets", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "lottery_tickets", "ordering": ["-created_at"]},
        ),
    ]
