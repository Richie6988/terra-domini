# Idempotent (see terra_domini/utils/migration_ops.py). Event tokens: 10 numbered editions, sellable (2026-10-18).
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0006_event_cards"),
    ]

    operations = [
        AddFieldIfMissing(model_name="eventcard", name="serial", field=models.IntegerField(default=1)),
        AddFieldIfMissing(model_name="eventcard", name="max_supply", field=models.IntegerField(default=10)),
        AddFieldIfMissing(model_name="eventcard", name="price_hex", field=models.IntegerField(blank=True, null=True)),
        AddFieldIfMissing(model_name="eventcard", name="listed_at", field=models.DateTimeField(blank=True, null=True)),
    ]
