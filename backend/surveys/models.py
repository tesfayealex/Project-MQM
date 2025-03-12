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
    
    # Template Relationship - allows creating surveys from templates
    template = models.ForeignKey('Template', on_delete=models.SET_NULL, null=True, blank=True, 
                                related_name='derived_surveys',
                                help_text="Template this survey was created from, if any")
    
    # Multilingual Content
    headlines = models.JSONField(default=dict, blank=True, help_text="Headline text for each language: {'en': 'English Headline', 'de': 'German Headline'}")
    survey_texts = models.JSONField(default=dict, blank=True, help_text="Survey introduction text for each language")
    
    # Project Address
    city = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    
    # Project Token (legacy)
    token = models.CharField(max_length=100, blank=True, null=True, help_text="Only lowercase letters, no special characters, no spaces. Legacy field, use tokens instead.")
    
    # Project Details
    languages = ArrayField(
        models.CharField(max_length=2, choices=LANGUAGE_CHOICES),
        default=list,
        help_text="List of languages supported by this survey"
    )
    format = models.CharField(max_length=20, choices=FORMAT_CHOICES, default='online')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='public')
    start_datetime = models.DateTimeField(blank=True, null=True)
    expiry_date = models.DateTimeField(blank=True, null=True, help_text="End date and time for the survey")
    analysis_cluster = models.CharField(max_length=50, choices=ANALYSIS_CLUSTER_CHOICES, default='Standard', blank=True, null=True)
    
    # End Survey Information
    start_survey_titles = models.JSONField(default=dict, blank=True, help_text="Titles to show when survey has not started yet for each language")
    start_survey_texts = models.JSONField(default=dict, blank=True, help_text="Messages to show when survey has not started yet for each language")
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
        return self.title

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
    """
    Represents a user's answer to a survey question.
    """
    response = models.ForeignKey(Response, related_name='answers', on_delete=models.CASCADE)
    question = models.ForeignKey(Question, related_name='answers', on_delete=models.SET_NULL, null=True, blank=True)
    nps_rating = models.IntegerField(null=True, blank=True)
    text_answer = models.TextField(null=True, blank=True)
    sentiment_score = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed = models.BooleanField(default=False, help_text="Whether this answer has been processed for word extraction")
    sentence_sentiments = models.JSONField(
        default=list, 
        blank=True, 
        help_text="List of sentences with sentiment scores: [{'text': 'Sentence text', 'sentiment': 0.5}, ...]"
    )

    def __str__(self):
        return f"Answer to {self.question} ({self.created_at})"
    
    def process_text_answer(self):
        """Process the text answer to extract words and associate them with clusters."""
        from .utils import process_text, analyze_sentences, analyze_sentences_with_openai, process_sentence, assign_clusters_to_words
        
        if not self.text_answer or self.processed:
            return
        
        # Get the language from the response
        language = self.response.language
        survey = self.response.survey
        
        # 1. Analyze text at sentence level for sentiment
        sentence_data = analyze_sentences_with_openai(self.text_answer, language)
        print(sentence_data)
        self.sentence_sentiments = sentence_data
        
        # Initialize variables for word processing
        all_processed_words = []
        words_to_sentences = {}
        
        # 2. Process each sentence to extract words
        for idx, sentence_info in enumerate(sentence_data):
            sentence_text = sentence_info['text']
            sentence_idx = sentence_info['index']
            
            # Extract words from this sentence
            sentence_words = process_sentence(sentence_text, language)
            print("sentence_words: " + str(sentence_text))
            print(sentence_words)
            
            # Map each word to its source sentence
            for word in sentence_words:
                words_to_sentences[word] = {
                    'text': sentence_text,
                    'index': sentence_idx
                }
            
            # Add to our complete list of processed words
            all_processed_words.extend(sentence_words)
        
        # 3. Create ResponseWord instances for each processed word
        if all_processed_words:
            # Assign clusters to words using the utility function
            word_clusters = assign_clusters_to_words(self.text_answer, all_processed_words, language, survey)
            
            # Create ResponseWord instances for each processed word
            for word in all_processed_words:
                # Get sentence data for this word
                sentence_data = words_to_sentences.get(word, {})
                sentence_text = sentence_data.get('text', '')
                sentence_idx = sentence_data.get('index', None)
                
                # Get assigned cluster from word_clusters dictionary
                assigned_cluster = word_clusters.get(word, 'Other')
                
                # Create the ResponseWord instance
                response_word = ResponseWord.objects.create(
                    response=self.response,
                    answer=self,
                    word=word,
                    original_text=self.text_answer,
                    language=language,
                    sentence_text=sentence_text,
                    sentence_index=sentence_idx,
                    assigned_cluster=assigned_cluster
                )
                
                # Find and associate with the matching custom cluster
                from .models import CustomWordCluster
                if assigned_cluster != 'Other':
                    try:
                        # Check if this cluster already exists, if not create it
                        cluster_obj, created = CustomWordCluster.objects.get_or_create(
                            name=assigned_cluster,
                            defaults={
                                'created_by': self.response.survey.created_by,
                                'is_active': True,
                                'description': f'Auto-created cluster from survey {self.response.survey.description}'
                            }
                        )
                        
                        response_word.custom_clusters.add(cluster_obj)
                        
                        # Update the last_processed timestamp for the cluster
                        cluster_obj.last_processed = timezone.now()
                        cluster_obj.save(update_fields=['last_processed'])
                        
                        # Update the word count asynchronously
                        cluster_obj.update_word_count()
                    except Exception as e:
                        print(f"Error associating word with cluster: {str(e)}")
        
        # 4. Mark as processed and save sentence sentiment data
        self.processed = True
        self.save(update_fields=['processed', 'sentence_sentiments'])

    def get_average_sentiment(self):
        """Calculate the average sentiment score across all sentences in this answer."""
        if not self.sentence_sentiments:
            return 0.0
            
        total_sentiment = sum(sent.get('sentiment', 0) for sent in self.sentence_sentiments)
        return total_sentiment / len(self.sentence_sentiments) if self.sentence_sentiments else 0.0
    
    def get_positive_sentences(self):
        """Return a list of sentences with positive sentiment (sentiment > 0.05)."""
        if not self.sentence_sentiments:
            return []
            
        return [sent for sent in self.sentence_sentiments if sent.get('sentiment', 0) > 0.05]
    
    def get_negative_sentences(self):
        """Return a list of sentences with negative sentiment (sentiment < -0.05)."""
        if not self.sentence_sentiments:
            return []
            
        return [sent for sent in self.sentence_sentiments if sent.get('sentiment', 0) < -0.05]
    
    def get_neutral_sentences(self):
        """Return a list of sentences with neutral sentiment (-0.05 <= sentiment <= 0.05)."""
        if not self.sentence_sentiments:
            return []
            
        return [sent for sent in self.sentence_sentiments 
                if -0.05 <= sent.get('sentiment', 0) <= 0.05]
    
    def get_sentiment_distribution(self):
        """Return a dictionary with the distribution of sentiment categories."""
        if not self.sentence_sentiments:
            return {'positive': 0, 'negative': 0, 'neutral': 0, 'total': 0}
            
        positive = len(self.get_positive_sentences())
        negative = len(self.get_negative_sentences())
        neutral = len(self.get_neutral_sentences())
        total = len(self.sentence_sentiments)
        
        return {
            'positive': positive,
            'negative': negative,
            'neutral': neutral,
            'total': total,
            'positive_pct': (positive / total) * 100 if total else 0,
            'negative_pct': (negative / total) * 100 if total else 0,
            'neutral_pct': (neutral / total) * 100 if total else 0
        }


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
    sentence_text = models.TextField(blank=True, null=True, help_text="The sentence this word was extracted from")
    sentence_index = models.IntegerField(null=True, blank=True, help_text="Index of the sentence this word was extracted from")
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

    def get_sentence_sentiment(self):
        """
        Return the sentiment score of the sentence this word belongs to.
        Returns None if sentence data isn't available.
        """
        if not self.answer or not self.sentence_index:
            return None
            
        # Find the sentence in the answer's sentence_sentiments data
        for sent in self.answer.sentence_sentiments:
            if sent.get('index') == self.sentence_index:
                return sent.get('sentiment', 0)
                
        return None
        
    def get_sentence_sentiment_category(self):
        """
        Return the sentiment category (positive, negative, neutral) of the 
        sentence this word belongs to.
        """
        sentiment = self.get_sentence_sentiment()
        
        if sentiment is None:
            return 'unknown'
        elif sentiment > 0.05:
            return 'positive'
        elif sentiment < -0.05:
            return 'negative'
        else:
            return 'neutral'
            
    def is_in_positive_sentence(self):
        """Return True if this word appears in a positive sentence."""
        return self.get_sentence_sentiment_category() == 'positive'
        
    def is_in_negative_sentence(self):
        """Return True if this word appears in a negative sentence."""
        return self.get_sentence_sentiment_category() == 'negative'
        
    def is_in_neutral_sentence(self):
        """Return True if this word appears in a neutral sentence."""
        return self.get_sentence_sentiment_category() == 'neutral'


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


class Template(models.Model):
    LANGUAGE_CHOICES = Survey.LANGUAGE_CHOICES
    
    FORMAT_CHOICES = Survey.FORMAT_CHOICES
    
    TYPE_CHOICES = Survey.TYPE_CHOICES
    
    ANALYSIS_CLUSTER_CHOICES = Survey.ANALYSIS_CLUSTER_CHOICES
    
    # Basic Template Info
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # Multilingual Content
    headlines = models.JSONField(default=dict, blank=True, help_text="Headline text for each language: {'en': 'English Headline', 'de': 'German Headline'}")
    survey_texts = models.JSONField(default=dict, blank=True, help_text="Survey introduction text for each language")
    
    # Project Details
    languages = ArrayField(
        models.CharField(max_length=2, choices=LANGUAGE_CHOICES),
        default=list,
        help_text="List of languages supported by this template"
    )
    format = models.CharField(max_length=20, choices=FORMAT_CHOICES, default='online')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='public')
    analysis_cluster = models.CharField(max_length=50, choices=ANALYSIS_CLUSTER_CHOICES, default='Standard', blank=True, null=True)
    
    # End Survey Information
    start_survey_titles = models.JSONField(default=dict, blank=True, help_text="Titles to show when survey has not started yet for each language")
    start_survey_texts = models.JSONField(default=dict, blank=True, help_text="Messages to show when survey has not started yet for each language")
    end_survey_titles = models.JSONField(default=dict, blank=True, help_text="Titles to show at the end of survey for each language")
    end_survey_texts = models.JSONField(default=dict, blank=True, help_text="Messages to show at the end of survey for each language")
    expired_survey_titles = models.JSONField(default=dict, blank=True, help_text="Expired survey titles for each language")
    expired_survey_texts = models.JSONField(default=dict, blank=True, help_text="Expired survey texts for each language")
    
    # Clusters
    clusters = models.ManyToManyField('CustomWordCluster', related_name='templates', blank=True)
    
    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return self.title


# Add a model for template questions
class TemplateQuestion(models.Model):
    QUESTION_TYPES = Question.QUESTION_TYPES
    
    template = models.ForeignKey(Template, related_name='questions', on_delete=models.CASCADE)
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
        question_text = next(iter(self.questions.values()), "Unnamed Question")
        return f"{self.template.title} - Q{self.order}: {question_text[:30]}"


# Create a signal handler to process text answers
@receiver(post_save, sender=Answer)
def process_answer_text(sender, instance, created, **kwargs):
    """Process text answer when an Answer is created or updated."""
    # Only process if there's a text_answer and it hasn't been processed yet
    if instance.text_answer and not instance.processed:
        instance.process_text_answer()


# Signal to process survey responses asynchronously
@receiver(post_save, sender=Response)
def process_response_answers(sender, instance, created, **kwargs):
    """
    Processes all answers in a response asynchronously when a new response is created.
    This signal runs after the HTTP response is sent to the user, making the survey submission faster.
    """
    if created:  # Only process for newly created responses
        # Set up a task to process all text answers in this response
        # This runs in the background after the HTTP response is returned
        from threading import Thread
        
        def process_answers_task():
            try:
                # Process all text answers in this response
                for answer in instance.answers.filter(text_answer__isnull=False):
                    if answer.text_answer.strip():  # Skip empty answers
                        try:
                            answer.process_text_answer()
                        except Exception as e:
                            print(f"Error processing answer {answer.id}: {str(e)}")
            except Exception as e:
                print(f"Error in background task for response {instance.id}: {str(e)}")
        
        # Start background thread
        Thread(target=process_answers_task).start()

