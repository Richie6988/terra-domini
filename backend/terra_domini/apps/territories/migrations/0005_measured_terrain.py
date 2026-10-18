# Idempotent (see terra_domini/utils/migration_ops.py). Measured terrain: ESA WorldCover + elevation (2026-10-18).
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing


class Migration(migrations.Migration):

    dependencies = [("territories", "0004_safari_grid_hunt")]

    operations = [
        AddFieldIfMissing(model_name="territory", name="terrain_source", field=models.CharField(blank=True, default="", max_length=20)),
        AddFieldIfMissing(model_name="territory", name="elevation_m", field=models.IntegerField(blank=True, null=True)),
    ]
