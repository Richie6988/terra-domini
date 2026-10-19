# Idempotent (see terra_domini/utils/migration_ops.py). Several tickets per event, prices climbing in the day (2026-10-19).
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing


class Migration(migrations.Migration):

    dependencies = [("events", "0007_event_card_editions")]

    operations = [
        AddFieldIfMissing(model_name="newseventregistration", name="tickets", field=models.IntegerField(default=1)),
    ]
