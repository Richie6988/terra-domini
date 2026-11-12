from django.db import migrations, models

from terra_domini.apps.events.unified_poi import POICategory


class Migration(migrations.Migration):
    """Adds the 'city' token category (living cities, towns and districts; trade_node keeps markets and trade hubs)."""

    dependencies = [("events", "0008_registration_tickets")]

    operations = [
        migrations.AlterField(
            model_name='unifiedpoi',
            name='category',
            field=models.CharField(choices=POICategory.choices, db_index=True, max_length=30),
        ),
    ]
