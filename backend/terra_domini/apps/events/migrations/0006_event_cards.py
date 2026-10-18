# Idempotent (see terra_domini/utils/migration_ops.py). News tokens won on world events (2026-10-18).
import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from terra_domini.utils.migration_ops import CreateModelIfMissing


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0005_poi_wiki_history"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        CreateModelIfMissing(
            name="EventCard",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("headline", models.CharField(max_length=300)),
                ("kind", models.CharField(blank=True, default="", max_length=20)),
                ("location_name", models.CharField(blank=True, default="", max_length=200)),
                ("h3_index", models.CharField(blank=True, default="", max_length=20)),
                ("latitude", models.FloatField(blank=True, null=True)),
                ("longitude", models.FloatField(blank=True, null=True)),
                ("rarity", models.CharField(default="rare", max_length=12)),
                ("image_url", models.URLField(blank=True, default="", max_length=512)),
                ("source_url", models.URLField(blank=True, default="", max_length=512)),
                ("event_date", models.DateField()),
                ("won_at", models.DateTimeField(auto_now_add=True)),
                ("event", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="cards", to="events.newsevent")),
                ("player", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="event_cards", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "event_cards", "ordering": ["-event_date"], "unique_together": {("player", "event")}},
        ),
    ]
