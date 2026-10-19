# Idempotent (see terra_domini/utils/migration_ops.py). Lucky wheel land prizes (2026-10-19).
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing


class Migration(migrations.Migration):

    dependencies = [("economy", "0005_pickups")]

    operations = [
        AddFieldIfMissing(model_name="lotteryticket", name="won_h3", field=models.CharField(max_length=20, blank=True, default="")),
        AddFieldIfMissing(model_name="lotteryticket", name="won_kind", field=models.CharField(max_length=10, blank=True, default="")),
    ]
