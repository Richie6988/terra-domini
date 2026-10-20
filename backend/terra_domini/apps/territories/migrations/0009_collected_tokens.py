# Collected token cards (2026-10-20): a token stays in the album of every player who took its hex (one card per
# edition); only the current holder earns from it. Backfill: current holders of token hexes get their card.
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

from terra_domini.utils.migration_ops import CreateModelIfMissing


def backfill(apps, schema_editor):
    Territory = apps.get_model('territories', 'Territory')
    CollectedToken = apps.get_model('territories', 'CollectedToken')
    UnifiedPOI = apps.get_model('events', 'UnifiedPOI')
    names = dict(UnifiedPOI.objects.filter(is_active=True).values_list('h3_index', 'name'))
    rows = [CollectedToken(player_id=t.owner_id, h3_index=t.h3_index, edition=t.nft_version or 1, name=names[t.h3_index][:300])
            for t in Territory.objects.filter(owner__isnull=False, h3_index__in=list(names)).only('owner_id', 'h3_index', 'nft_version')]
    CollectedToken.objects.bulk_create(rows, ignore_conflicts=True, batch_size=500)


class Migration(migrations.Migration):

    dependencies = [("territories", "0008_plain_hexes"), ("events", "0008_registration_tickets"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        CreateModelIfMissing(
            name='CollectedToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('h3_index', models.CharField(db_index=True, max_length=20)),
                ('edition', models.PositiveIntegerField(default=1)),
                ('name', models.CharField(blank=True, default='', max_length=300)),
                ('acquired_at', models.DateTimeField(auto_now_add=True)),
                ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='collected_tokens', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'collected_tokens', 'ordering': ['-acquired_at'], 'unique_together': {('player', 'h3_index', 'edition')}},
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
