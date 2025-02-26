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
    end_date = models.DateTimeField(blank=True, null=True)
    analysis_end_date = models.DateTimeField(blank=True, null=True)
    analysis_cluster = models.CharField(max_length=50, choices=ANALYSIS_CLUSTER_CHOICES, default='Standard', blank=True, null=True)
    
    # End Survey Information
    end_survey_titles = models.JSONField(default=dict, blank=True, help_text="Titles to show at the end of survey for each language")
    expired_survey_titles = models.JSONField(default=dict, blank=True, help_text="Expired survey titles for each language")
    expired_survey_texts = models.JSONField(default=dict, blank=True, help_text="Expired survey texts for each language")
    
    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.title or self.short_id


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

