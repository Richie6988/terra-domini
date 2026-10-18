# Idempotent (see terra_domini/utils/migration_ops.py)
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_harvest_and_purchased_hex"),
    ]

    operations = [
        AddFieldIfMissing(
            model_name="player",
            name="last_draft_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
