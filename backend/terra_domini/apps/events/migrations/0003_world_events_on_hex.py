# Idempotent (see terra_domini/utils/migration_ops.py). Real events pinned to a POI hex (2026-10-18).
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing


def drop_fake_demo_events(apps, schema_editor):
    # `fetch_news --demo` created invented headlines (RULE 1: no fake data) — events are real only now
    apps.get_model("events", "NewsEvent").objects.filter(source_url__startswith="https://demo.hexod.dev/").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0002_newsevents"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        AddFieldIfMissing(model_name="newsevent", name="event_kind", field=models.CharField(blank=True, default="", max_length=20)),
        AddFieldIfMissing(model_name="newsevent", name="h3_index", field=models.CharField(blank=True, db_index=True, default="", max_length=20)),
        AddFieldIfMissing(model_name="newsevent", name="poi_name", field=models.CharField(blank=True, default="", max_length=300)),
        migrations.RunPython(drop_fake_demo_events, migrations.RunPython.noop),
        AddFieldIfMissing(model_name="newsevent", name="winner", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="events_won", to=settings.AUTH_USER_MODEL)),
    ]
