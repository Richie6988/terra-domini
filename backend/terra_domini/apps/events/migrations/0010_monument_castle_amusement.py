from django.db import migrations, models

from terra_domini.apps.events.unified_poi import POICategory


class Migration(migrations.Migration):
    """Adds the 'monument', 'castle' and 'amusement_park' token categories (owner 2026-11-16)."""

    dependencies = [("events", "0009_city_category")]

    operations = [
        migrations.AlterField(
            model_name='unifiedpoi',
            name='category',
            field=models.CharField(choices=POICategory.choices, db_index=True, max_length=30),
        ),
    ]
