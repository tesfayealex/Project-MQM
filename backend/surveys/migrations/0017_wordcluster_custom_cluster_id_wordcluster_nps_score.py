# Generated by Django 5.1.6 on 2025-03-05 10:05

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0016_wordcluster_category_alter_wordcluster_description_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='wordcluster',
            name='custom_cluster_id',
            field=models.IntegerField(blank=True, help_text='ID of the custom cluster this was derived from, if any', null=True),
        ),
        migrations.AddField(
            model_name='wordcluster',
            name='nps_score',
            field=models.FloatField(blank=True, help_text='Average NPS score associated with this cluster', null=True),
        ),
    ]
