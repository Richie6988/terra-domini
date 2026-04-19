import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('accounts', '0001_initial'),
    ]

    operations = [
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
    ]
