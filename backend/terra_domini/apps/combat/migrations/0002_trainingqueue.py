import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('combat', '0001_initial'),
    ]

    operations = [
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
    ]
