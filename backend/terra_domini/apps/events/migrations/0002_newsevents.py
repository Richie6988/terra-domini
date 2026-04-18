import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('events', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='NewsEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('source_url', models.URLField(max_length=512, unique=True)),
                ('source_name', models.CharField(default='', max_length=100)),
                ('headline', models.CharField(max_length=300)),
                ('summary', models.TextField(default='')),
                ('image_url', models.URLField(blank=True, default='', max_length=512)),
                ('published_at', models.DateTimeField()),
                ('location_name', models.CharField(default='GLOBAL', max_length=200)),
                ('latitude', models.FloatField(default=0.0)),
                ('longitude', models.FloatField(default=0.0)),
                ('country_code', models.CharField(default='', max_length=3)),
                ('hexod_category', models.CharField(default='news', max_length=30)),
                ('rarity', models.CharField(choices=[('common', 'Common'), ('uncommon', 'Uncommon'), ('rare', 'Rare'), ('epic', 'Epic'), ('legendary', 'Legendary'), ('mythic', 'Mythic')], default='rare', max_length=12)),
                ('status', models.CharField(choices=[('live', 'Live'), ('upcoming', 'Upcoming'), ('ended', 'Ended'), ('expired', 'Expired')], default='live', max_length=12)),
                ('hex_reward', models.IntegerField(default=50)),
                ('max_participants', models.IntegerField(default=500)),
                ('registration_cost', models.IntegerField(default=25)),
                ('starts_at', models.DateTimeField()),
                ('ends_at', models.DateTimeField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'news_events',
                'ordering': ['-starts_at'],
            },
        ),
        migrations.CreateModel(
            name='NewsEventRegistration',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('registered_at', models.DateTimeField(auto_now_add=True)),
                ('result', models.CharField(choices=[('pending', 'Pending'), ('won', 'Won'), ('lost', 'Lost')], default='pending', max_length=10)),
                ('hex_earned', models.IntegerField(default=0)),
                ('token_serial', models.IntegerField(blank=True, null=True)),
                ('luck_bonus', models.IntegerField(default=0)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='registrations', to='events.newsevent')),
                ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='event_registrations', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'news_event_registrations',
                'unique_together': {('event', 'player')},
            },
        ),
    ]
