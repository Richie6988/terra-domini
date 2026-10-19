# Idempotent (see terra_domini/utils/migration_ops.py). World safari: the creature hides where it really lives (2026-10-19).
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing


class Migration(migrations.Migration):

    dependencies = [("territories", "0005_measured_terrain")]

    operations = [
        AddFieldIfMissing(model_name="safaritarget", name="mode", field=models.CharField(default="local", max_length=8)),
    ]
