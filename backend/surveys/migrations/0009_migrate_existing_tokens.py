from django.db import migrations


def migrate_existing_tokens(apps, schema_editor):
    """
    Migrate existing survey tokens to the new SurveyToken model
    """
    Survey = apps.get_model('surveys', 'Survey')
    SurveyToken = apps.get_model('surveys', 'SurveyToken')
    
    # Get all surveys with tokens
    surveys_with_tokens = Survey.objects.exclude(token__isnull=True).exclude(token="")
    
    for survey in surveys_with_tokens:
        # Check if a token already exists for this survey
        existing_token = SurveyToken.objects.filter(survey=survey, token=survey.token).first()
        if not existing_token and survey.token:
            # Create a new SurveyToken for this survey
            SurveyToken.objects.create(
                survey=survey,
                token=survey.token,
                description="Default Token"
            )
    
    # For surveys without tokens, create a default token
    surveys_without_tokens = Survey.objects.filter(token__isnull=True) | Survey.objects.filter(token="")
    
    for survey in surveys_without_tokens:
        # Check if this survey already has any tokens
        if not SurveyToken.objects.filter(survey=survey).exists():
            # Generate a random token
            import random
            import string
            random_token = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
            
            # Create a new SurveyToken
            SurveyToken.objects.create(
                survey=survey,
                token=random_token,
                description="Default Token"
            )


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0008_surveytoken'),
    ]

    operations = [
        migrations.RunPython(migrate_existing_tokens, migrations.RunPython.noop),
    ] 