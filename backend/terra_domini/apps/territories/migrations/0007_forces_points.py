# Idempotent (see terra_domini/utils/migration_ops.py). Forces: attack / defense / spy points on each hex (2026-10-19).
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing


class Migration(migrations.Migration):

    dependencies = [("territories", "0006_safari_world")]

    operations = [
        AddFieldIfMissing(model_name="territory", name="atk_pts", field=models.IntegerField(default=0)),
        AddFieldIfMissing(model_name="territory", name="def_pts", field=models.IntegerField(default=0)),
        AddFieldIfMissing(model_name="territory", name="spy_pts", field=models.IntegerField(default=0)),
    ]
