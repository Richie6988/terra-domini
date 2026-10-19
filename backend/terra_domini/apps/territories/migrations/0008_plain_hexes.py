# Plain hexes (2026-10-19): a hex with no token has no rarity and no shiny — value comes from the tokens placed on
# specific hexes (events.UnifiedPOI). Resets the rarity rolled at first click on every token-less hex. Idempotent.
from django.db import migrations


def forwards(apps, schema_editor):
    Territory = apps.get_model('territories', 'Territory')
    UnifiedPOI = apps.get_model('events', 'UnifiedPOI')
    with_token = set(UnifiedPOI.objects.filter(is_active=True).values_list('h3_index', flat=True))
    qs = Territory.objects.filter(is_landmark=False).exclude(h3_index__in=with_token)
    qs.exclude(rarity='common').update(rarity='common')
    qs.filter(is_shiny=True).update(is_shiny=False)


class Migration(migrations.Migration):

    dependencies = [("territories", "0007_forces_points"), ("events", "0008_registration_tickets")]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
