"""
Idempotent migration for FavoritePin model.
Uses CREATE TABLE IF NOT EXISTS to avoid conflicts with existing tables
created by ensure_db.py or previous manual schema setup.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


CREATE_SQL = """
CREATE TABLE IF NOT EXISTS favorite_pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(120) NOT NULL DEFAULT 'Saved Location',
    emoji VARCHAR(30) NOT NULL DEFAULT 'pin',
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    zoom INTEGER NOT NULL DEFAULT 15,
    created_at DATETIME NOT NULL,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS favorite_pins_player_id_idx ON favorite_pins(player_id);
"""

REVERSE_SQL = "DROP TABLE IF EXISTS favorite_pins;"


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(CREATE_SQL, REVERSE_SQL),
            ],
            state_operations=[
                migrations.CreateModel(
                    name='FavoritePin',
                    fields=[
                        ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('name', models.CharField(default='Saved Location', max_length=120)),
                        ('emoji', models.CharField(default='pin', max_length=30)),
                        ('lat', models.FloatField()),
                        ('lon', models.FloatField()),
                        ('zoom', models.IntegerField(default=15)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pins', to=settings.AUTH_USER_MODEL)),
                    ],
                    options={
                        'db_table': 'favorite_pins',
                        'ordering': ['-created_at'],
                    },
                ),
            ],
        ),
    ]
