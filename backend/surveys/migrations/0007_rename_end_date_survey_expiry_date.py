# Generated by Django 5.1.6 on 2025-02-28 10:21

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0006_survey_end_survey_texts'),
    ]

    operations = [
        migrations.RenameField(
            model_name='survey',
            old_name='end_date',
            new_name='expiry_date',
        ),
    ]
