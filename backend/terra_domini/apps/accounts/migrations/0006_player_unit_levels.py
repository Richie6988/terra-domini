# Idempotent (see terra_domini/utils/migration_ops.py)
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_player_last_draft_at"),
    ]

    operations = [
        AddFieldIfMissing(
            model_name="player",
            name="unit_levels",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
