from django.db import models
from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
import json


class Survey(models.Model):
    LANGUAGE_CHOICES = [
        ('en', 'English'),
        ('de', 'German'),
        ('es', 'Spanish'),
        ('pt', 'Portuguese'),
    ]
    
    FORMAT_CHOICES = [
        ('online', 'Online'),
        ('face_to_face', 'Face to Face'),
    ]
    
    TYPE_CHOICES = [
        ('friends_family', 'Friends and Family'),
        ('public', 'Public'),
        ('professional', 'Professional'),
        ('single_company', 'Single Company'),
        ('intracompany', 'Intracompany'),
    ]
    
    ANALYSIS_CLUSTER_CHOICES = [
        ('Standard', 'Standard'),
        ('CoreNet Event', 'CoreNet Event'),
        ('Event & Conference', 'Event & Conference'),
        ('HomeOffice', 'HomeOffice'),
    ]
    
    # Basic Survey Info
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # Multilingual Content
    headlines = models.JSONField(default=dict, blank=True, help_text="Headline text for each language: {'en': 'English Headline', 'de': 'German Headline'}")
    survey_texts = models.JSONField(default=dict, blank=True, help_text="Survey introduction text for each language")
    
    # Project Information
    building_name = models.CharField(max_length=255, blank=True, null=True)
    short_id = models.CharField(max_length=50, blank=True, null=True)
    project_description = models.TextField(blank=True, null=True)
    
    # Project Address
    street_number = models.CharField(max_length=100, blank=True, null=True)
    city_code = models.CharField(max_length=50, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    
    # Project Token
    token = models.CharField(max_length=100, unique=True, blank=True, null=True, help_text="Only lowercase letters, no special characters, no spaces")
    
    # Project Details
    languages = ArrayField(
        models.CharField(max_length=2, choices=LANGUAGE_CHOICES),
        default=list,
        help_text="List of languages supported by this survey"
    )
    format = models.CharField(max_length=20, choices=FORMAT_CHOICES, default='online')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='public')
    max_participants = models.PositiveIntegerField(default=100)
    expiry_date = models.DateTimeField(blank=True, null=True)
    analysis_end_date = models.DateTimeField(blank=True, null=True)
    analysis_cluster = models.CharField(max_length=50, choices=ANALYSIS_CLUSTER_CHOICES, default='Standard', blank=True, null=True)
    
    # End Survey Information
    end_survey_titles = models.JSONField(default=dict, blank=True, help_text="Titles to show at the end of survey for each language")
    end_survey_texts = models.JSONField(default=dict, blank=True, help_text="Messages to show at the end of survey for each language")
    expired_survey_titles = models.JSONField(default=dict, blank=True, help_text="Expired survey titles for each language")
    expired_survey_texts = models.JSONField(default=dict, blank=True, help_text="Expired survey texts for each language")
    
    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.title or self.short_id

    @property
    def primary_token(self):
        """Returns the first token from the related tokens or the legacy token field."""
        token_obj = self.tokens.first()
        if token_obj:
            return token_obj.token
        return self.token
        
    def save(self, *args, **kwargs):
        """Override save to create a default token if none exists."""
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        # After saving, if this is a new survey and it has a token but no SurveyToken objects,
        # create a SurveyToken for backward compatibility
        if is_new and self.token and not self.tokens.exists():
            SurveyToken.objects.create(
                survey=self,
                token=self.token,
                description="Default Token"
            )
        # Alternatively, if new and no token exists at all, create a default token
        elif is_new and not self.tokens.exists():
            import random
            import string
            # Generate a random token
            random_token = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
            SurveyToken.objects.create(
                survey=self,
                token=random_token,
                description="Default Token"
            )


class SurveyToken(models.Model):
    """
    Model to represent multiple access tokens for a single survey.
    Each token can be used to access the survey, allowing for A/B testing
    by separating the survey for different areas/people.
    """
    survey = models.ForeignKey(Survey, related_name='tokens', on_delete=models.CASCADE)
    token = models.CharField(max_length=100, unique=True, help_text="Only lowercase letters, no special characters, no spaces")
    description = models.CharField(max_length=255, help_text="Description of the token's purpose (e.g., 'Group A', 'Office Staff')")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
    
    def __str__(self):
        return f"{self.token} ({self.description})"


class Question(models.Model):
    QUESTION_TYPES = [
        ('nps', 'Net Promoter Score'),
        ('free_text', 'Free Text'),
    ]
    
    survey = models.ForeignKey(Survey, related_name='questions', on_delete=models.CASCADE)
    # Multilingual content for questions
    questions = models.JSONField(default=dict, help_text="Question text for each language: {'en': 'English question', 'de': 'German question'}")
    placeholders = models.JSONField(default=dict, blank=True, null=True, help_text="Placeholder text for each language")
    
    type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    order = models.IntegerField()
    is_required = models.BooleanField(default=True)
    language = models.CharField(max_length=2, choices=Survey.LANGUAGE_CHOICES, default='en', help_text="Primary language of this question")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.survey.title} - {self.questions.get(self.language, 'Untitled Question')[:50]}"


class Response(models.Model):
    survey = models.ForeignKey(Survey, related_name='responses', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    session_id = models.CharField(max_length=100, unique=True)
    language = models.CharField(max_length=2, choices=Survey.LANGUAGE_CHOICES, default='en', help_text="Language used for this response")
    token = models.CharField(max_length=100, blank=True, null=True, help_text="The token used to access this survey")
    survey_token = models.ForeignKey(SurveyToken, related_name='responses', on_delete=models.SET_NULL, null=True, blank=True, help_text="Reference to the specific token used (if available)")

    def __str__(self):
        return f"Response to {self.survey.title} ({self.created_at})"


class Answer(models.Model):
    response = models.ForeignKey(Response, related_name='answers', on_delete=models.CASCADE)
    question = models.ForeignKey(Question, related_name='answers', on_delete=models.CASCADE)
    nps_rating = models.IntegerField(null=True, blank=True)
    text_answer = models.TextField(null=True, blank=True)
    sentiment_score = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Answer to {self.question.questions.get(self.question.language, 'Untitled Question')[:50]}"

