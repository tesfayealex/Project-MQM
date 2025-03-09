from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0023_survey_template'),
    ]

    operations = [
        migrations.AlterField(
            model_name='survey',
            name='token',
            field=models.CharField(blank=True, help_text='Only lowercase letters, no special characters, no spaces. Legacy field, use tokens instead.', max_length=100, null=True),
        ),
    ] 