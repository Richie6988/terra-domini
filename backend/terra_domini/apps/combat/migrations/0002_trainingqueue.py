"""
Idempotent migration for TrainingQueue model.
Uses CREATE TABLE IF NOT EXISTS for safety.
"""
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


CREATE_SQL = """
CREATE TABLE IF NOT EXISTS training_queue (
    id CHAR(32) PRIMARY KEY,
    unit_type VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    started_at DATETIME NOT NULL,
    completes_at DATETIME NOT NULL,
    collected BOOL NOT NULL DEFAULT 0,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS training_queue_player_id_idx ON training_queue(player_id);
"""

REVERSE_SQL = "DROP TABLE IF EXISTS training_queue;"


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('combat', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(CREATE_SQL, REVERSE_SQL),
            ],
            state_operations=[
                migrations.CreateModel(
                    name='TrainingQueue',
                    fields=[
                        ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                        ('unit_type', models.CharField(max_length=20)),
                        ('quantity', models.IntegerField(default=1)),
                        ('started_at', models.DateTimeField(auto_now_add=True)),
                        ('completes_at', models.DateTimeField()),
                        ('collected', models.BooleanField(default=False)),
                        ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='training_queue', to=settings.AUTH_USER_MODEL)),
                    ],
                    options={
                        'db_table': 'training_queue',
                        'ordering': ['completes_at'],
                    },
                ),
            ],
        ),
    ]
