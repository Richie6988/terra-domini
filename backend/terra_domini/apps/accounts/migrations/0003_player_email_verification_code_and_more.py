# Idempotent (see terra_domini/utils/migration_ops.py): safe on DBs that already have these tables/columns.

from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing, AddIndexIfMissing, CreateModelIfMissing  # noqa: F401


def verify_staff(apps, schema_editor):
    # Same as `manage.py verify_admin`: staff predate email verification and were locked out
    apps.get_model("accounts", "Player").objects.filter(is_staff=True).update(email_verified=True)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_favoritepin"),
    ]

    operations = [
        AddFieldIfMissing(
            model_name="player",
            name="email_verification_code",
            field=models.CharField(blank=True, default="", max_length=6),
        ),
        AddFieldIfMissing(
            model_name="player",
            name="email_verification_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        AddFieldIfMissing(
            model_name="player",
            name="initial_country",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        AddFieldIfMissing(
            model_name="player",
            name="initial_lat",
            field=models.FloatField(blank=True, null=True),
        ),
        AddFieldIfMissing(
            model_name="player",
            name="initial_lon",
            field=models.FloatField(blank=True, null=True),
        ),
        AddFieldIfMissing(
            model_name="player",
            name="avatar_color",
            field=models.CharField(blank=True, default="#0099cc", max_length=9),
        ),
        migrations.AlterField(
            model_name="player",
            name="avatar_emoji",
            field=models.CharField(blank=True, default="🎖️", max_length=32),
        ),
        migrations.AlterField(
            model_name="favoritepin",
            name="emoji",
            field=models.CharField(default="📍", max_length=4),
        ),
        migrations.AlterField(
            model_name="favoritepin",
            name="id",
            field=models.BigAutoField(
                auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
            ),
        ),
        migrations.AlterField(
            model_name="favoritepin",
            name="name",
            field=models.CharField(default="📍 Saved Location", max_length=120),
        ),
        migrations.RunPython(verify_staff, migrations.RunPython.noop),
    ]
