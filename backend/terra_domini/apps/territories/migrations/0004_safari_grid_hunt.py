# Idempotent (see terra_domini/utils/migration_ops.py). Safari grid hunt (2026-10-18).
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing


class Migration(migrations.Migration):

    dependencies = [
        ("territories", "0003_safaritarget_captured_at_and_more"),
    ]

    operations = [
        AddFieldIfMissing(model_name="safaritarget", name="center_h3", field=models.CharField(blank=True, default="", max_length=24)),
        AddFieldIfMissing(model_name="safaritarget", name="tries_left", field=models.IntegerField(default=4)),
        AddFieldIfMissing(model_name="safaritarget", name="probes", field=models.JSONField(blank=True, default=list)),
    ]
