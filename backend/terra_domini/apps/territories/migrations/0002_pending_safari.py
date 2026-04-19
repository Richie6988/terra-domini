import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('territories', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PendingClaim',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('h3_index', models.CharField(max_length=24)),
                ('method', models.CharField(choices=[('explore', 'Exploration'), ('attack', 'Military Attack'), ('buy', 'Purchase')], max_length=12)),
                ('status', models.CharField(choices=[('in_progress', 'In Progress'), ('completed', 'Completed'), ('cancelled', 'Cancelled'), ('failed', 'Failed')], default='in_progress', max_length=12)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('hours_required', models.FloatField(default=1.0)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('is_adjacent', models.BooleanField(default=False)),
                ('territory_name', models.CharField(blank=True, max_length=120)),
                ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pending_claims', to=settings.AUTH_USER_MODEL)),
                ('territory', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='territories.territory')),
            ],
            options={
                'db_table': 'pending_claim',
                'ordering': ['-started_at'],
                'indexes': [
                    models.Index(fields=['player', 'status'], name='pending_cla_player__idx'),
                    models.Index(fields=['h3_index', 'status'], name='pending_cla_h3_inde_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='SafariTarget',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('creature_id', models.CharField(max_length=30)),
                ('creature_name', models.CharField(max_length=100)),
                ('rarity', models.CharField(default='common', max_length=20)),
                ('hex_reward', models.IntegerField(default=100)),
                ('target_lat', models.FloatField()),
                ('target_lon', models.FloatField()),
                ('target_h3', models.CharField(blank=True, max_length=24)),
                ('hint', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('active', 'Active'), ('captured', 'Captured'), ('expired', 'Expired')], default='active', max_length=12)),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='safari_targets', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'safari_targets',
                'ordering': ['-assigned_at'],
            },
        ),
        migrations.CreateModel(
            name='SafariCapture',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('creature_id', models.CharField(max_length=30)),
                ('creature_name', models.CharField(max_length=100)),
                ('rarity', models.CharField(max_length=20)),
                ('hex_earned', models.IntegerField(default=0)),
                ('captured_at', models.DateTimeField(auto_now_add=True)),
                ('capture_lat', models.FloatField(null=True)),
                ('capture_lon', models.FloatField(null=True)),
                ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='safari_captures', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'safari_captures',
                'ordering': ['-captured_at'],
            },
        ),
    ]
