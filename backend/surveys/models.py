from django.db import models
from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
from django.db.models.signals import post_save
from django.dispatch import receiver
import json
from django.utils import timezone


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
    processed = models.BooleanField(default=False, help_text="Whether this answer has been processed for word extraction")

    def __str__(self):
        return f"Answer to {self.question} ({self.created_at})"
    
    def process_text_answer(self):
        """Process the text answer to extract words and associate them with clusters."""
        from .utils import process_text
        
        if not self.text_answer or self.processed:
            return
        
        # Get the language from the response
        language = self.response.language
        
        # Process the text to extract words
        processed_words = process_text(self.text_answer, language)
        
        if processed_words:
            # Create ResponseWord instances for each processed word
            for word in processed_words:
                # Create the ResponseWord instance
                response_word = ResponseWord.objects.create(
                    response=self.response,
                    answer=self,
                    word=word,
                    original_text=self.text_answer,
                    language=language
                )
                
                # Associate with custom clusters if applicable
                active_clusters = CustomWordCluster.objects.filter(is_active=True)
                for cluster in active_clusters:
                    if cluster.matches_word(word):
                        response_word.custom_clusters.add(cluster)
                        
                        # Update the last_processed timestamp for the cluster
                        cluster.last_processed = timezone.now()
                        cluster.save(update_fields=['last_processed'])
                        
                        # Update the word count asynchronously
                        cluster.update_word_count()
        
        # Mark as processed
        self.processed = True
        self.save(update_fields=['processed'])


class WordCluster(models.Model):
    """
    Represents a cluster of related words identified in survey responses.
    Used for text analytics and sentiment analysis visualization.
    """
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    sentiment_score = models.FloatField(default=0)
    frequency = models.IntegerField(default=0)
    survey = models.ForeignKey('Survey', on_delete=models.CASCADE, related_name='word_clusters')
    is_positive = models.BooleanField(default=False)
    is_negative = models.BooleanField(default=False)
    is_neutral = models.BooleanField(default=True)
    category = models.CharField(max_length=50, default='neutral', choices=(
        ('positive', 'Positive'),
        ('negative', 'Negative'),
        ('neutral', 'Neutral'),
    ))
    nps_score = models.FloatField(null=True, blank=True, help_text="Average NPS score associated with this cluster")
    custom_cluster_id = models.IntegerField(null=True, blank=True, help_text="ID of the custom cluster this was derived from, if any")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['-frequency']


class CustomWordCluster(models.Model):
    """
    Represents a user-defined cluster of related words or phrases for analysis.
    These clusters can be applied across all surveys for consistent analysis.
    """
    name = models.CharField(max_length=100, help_text="Name of the custom cluster (e.g., 'Customer Service')")
    description = models.TextField(blank=True, help_text="Description of what this cluster represents")
    keywords = models.JSONField(default=list, help_text="List of keywords/phrases that belong to this cluster")
    is_active = models.BooleanField(default=True, help_text="Whether this cluster is currently active")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='custom_clusters')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    word_count = models.IntegerField(default=0, help_text="Number of words associated with this cluster")
    last_processed = models.DateTimeField(null=True, blank=True, help_text="When this cluster was last processed")

    class Meta:
        ordering = ['name']
        verbose_name = "Custom Word Cluster"
        verbose_name_plural = "Custom Word Clusters"

    def __str__(self):
        return f"{self.name} ({len(self.keywords)} keywords)"
    
    def matches_word(self, word):
        """Check if a word matches any of the keywords in this cluster."""
        if not word:
            return False
            
        # Convert word to lowercase for case-insensitive matching
        word = word.lower()
        
        # Check if word matches any of the keywords
        for keyword in self.keywords:
            if keyword.lower() in word or word in keyword.lower():
                return True
        
        return False
    
    def update_word_count(self):
        """Update the count of words associated with this cluster."""
        from django.db.models import Count
        
        # Count associated ResponseWord objects
        count = ResponseWord.objects.filter(
            custom_clusters__id=self.id
        ).values('word').distinct().count()
        
        self.word_count = count
        self.save(update_fields=['word_count'])
        
    def get_associated_words(self, limit=100):
        """Get the most common words associated with this cluster."""
        from django.db.models import Count
        
        # Get the most frequent words
        words = ResponseWord.objects.filter(
            custom_clusters__id=self.id
        ).values('word').annotate(
            count=Count('word')
        ).order_by('-count')[:limit]
        
        return list(words)


class ResponseWord(models.Model):
    """
    Stores individual words or short phrases extracted from text responses,
    along with their sentiment scores and cluster associations.
    Used for word cloud generation and text analytics.
    """
    response = models.ForeignKey(Response, related_name='extracted_words', on_delete=models.CASCADE)
    answer = models.ForeignKey(Answer, related_name='extracted_words', on_delete=models.CASCADE)
    word = models.CharField(max_length=100, help_text="The extracted word or short phrase")
    original_text = models.TextField(help_text="The original text context where this word appeared")
    frequency = models.IntegerField(default=1, help_text="Frequency of this word in the response")
    sentiment_score = models.FloatField(default=0.0, help_text="Sentiment score for this word (-1 to 1)")
    clusters = models.ManyToManyField(WordCluster, related_name='words', blank=True)
    custom_clusters = models.ManyToManyField(CustomWordCluster, related_name='words', blank=True)
    assigned_cluster = models.CharField(max_length=100, null=True, blank=True, help_text="Directly assigned cluster name for this word")
    language = models.CharField(max_length=2, choices=Survey.LANGUAGE_CHOICES, default='en')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-frequency', '-sentiment_score']
        indexes = [
            models.Index(fields=['word']),
            models.Index(fields=['sentiment_score']),
        ]

    def __str__(self):
        return f"{self.word} (Sentiment: {self.sentiment_score:.2f})"


class SurveyAnalysisSummary(models.Model):
    """
    Stores pre-calculated analysis summary data for each survey
    to improve performance when viewing analytics dashboards.
    """
    survey = models.OneToOneField(Survey, related_name='analysis_summary', on_delete=models.CASCADE)
    response_count = models.IntegerField(default=0)
    average_satisfaction = models.FloatField(default=0.0, help_text="Average NPS or satisfaction score")
    median_satisfaction = models.FloatField(default=0.0)
    satisfaction_confidence_low = models.FloatField(default=0.0, help_text="95% confidence interval - lower bound")
    satisfaction_confidence_high = models.FloatField(default=0.0, help_text="95% confidence interval - upper bound")
    satisfaction_score = models.FloatField(default=0.0, help_text="Calculated as [positive % - negative %]")
    
    # Language breakdown stored as JSON: {"en": 45, "de": 12, ...}
    language_breakdown = models.JSONField(default=dict)
    
    # Aggregated sentiment data
    positive_percentage = models.FloatField(default=0.0)
    negative_percentage = models.FloatField(default=0.0)
    neutral_percentage = models.FloatField(default=0.0)
    
    # Top clusters data - stored as JSON arrays of cluster IDs
    top_clusters = models.JSONField(default=list, help_text="IDs of most frequent clusters")
    top_positive_clusters = models.JSONField(default=list, help_text="IDs of most positive clusters")
    top_negative_clusters = models.JSONField(default=list, help_text="IDs of most negative clusters") 
    top_neutral_clusters = models.JSONField(default=list, help_text="IDs of most neutral clusters")
    
    # Weighted sentiment divergence
    sentiment_divergence = models.FloatField(default=0.0, help_text="Frequency weighted sentiment score divergence")
    
    # Timestamp for when this summary was last updated
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Analysis Summary for {self.survey.title} ({self.last_updated})"


# Create a signal handler to process text answers
@receiver(post_save, sender=Answer)
def process_answer_text(sender, instance, created, **kwargs):
    """Process text answer when an Answer is created or updated."""
    # Only process if there's a text_answer and it hasn't been processed yet
    if instance.text_answer and not instance.processed:
        instance.process_text_answer()

