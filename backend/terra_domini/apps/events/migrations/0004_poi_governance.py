# Idempotent (see terra_domini/utils/migration_ops.py). Admin token editor: governance fields (2026-10-18).
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0003_world_events_on_hex"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        AddFieldIfMissing(model_name="unifiedpoi", name="db_uid", field=models.CharField(blank=True, db_index=True, default="", max_length=60)),
        AddFieldIfMissing(model_name="unifiedpoi", name="image_url", field=models.URLField(blank=True, default="", max_length=500)),
        AddFieldIfMissing(model_name="unifiedpoi", name="validated_by", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="validated_pois", to=settings.AUTH_USER_MODEL)),
        AddFieldIfMissing(model_name="unifiedpoi", name="validated_at", field=models.DateTimeField(blank=True, null=True)),
    ]
