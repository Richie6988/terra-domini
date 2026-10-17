# Idempotent (see terra_domini/utils/migration_ops.py)
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_player_email_verification_code_and_more"),
    ]

    operations = [
        AddFieldIfMissing(
            model_name="player",
            name="hex_purchased_balance",
            field=models.DecimalField(decimal_places=6, default=0, max_digits=20),
        ),
        AddFieldIfMissing(
            model_name="player",
            name="harvest_last_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
