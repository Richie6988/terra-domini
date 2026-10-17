# Idempotent (see terra_domini/utils/migration_ops.py): safe on DBs that already have these tables/columns.

from django.conf import settings
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing, AddIndexIfMissing, CreateModelIfMissing  # noqa: F401


class Migration(migrations.Migration):

    dependencies = [
        ("territories", "0002_pending_safari"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        AddFieldIfMissing(
            model_name="safaritarget",
            name="captured_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        AddFieldIfMissing(
            model_name="safaritarget",
            name="distance_at_capture",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="pendingclaim",
            name="id",
            field=models.BigAutoField(
                auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
            ),
        ),
        migrations.AlterField(
            model_name="safaricapture",
            name="id",
            field=models.BigAutoField(
                auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
            ),
        ),
        migrations.AlterField(
            model_name="safaritarget",
            name="id",
            field=models.BigAutoField(
                auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
            ),
        ),
        AddIndexIfMissing(
            model_name="pendingclaim",
            index=models.Index(
                fields=["player", "status"], name="pending_cla_player__e9b6af_idx"
            ),
        ),
        AddIndexIfMissing(
            model_name="pendingclaim",
            index=models.Index(
                fields=["h3_index", "status"], name="pending_cla_h3_inde_0f50a8_idx"
            ),
        ),
    ]
