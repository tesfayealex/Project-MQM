from rest_framework import serializers
from .models import Survey, Question, Response, Answer, SurveyToken, WordCluster, ResponseWord, SurveyAnalysisSummary, CustomWordCluster, Template, TemplateQuestion
from django.db import models


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = [
            'id', 'questions', 'placeholders', 'type', 'order', 'is_required', 'language', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class TemplateQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TemplateQuestion
        fields = [
            'id', 'questions', 'placeholders', 'type', 'order', 'is_required', 'language', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class SurveyTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyToken
        fields = ['id', 'token', 'description', 'created_at']
        read_only_fields = ['created_at']
    
    def validate_token(self, value):
        """
        Check that the token contains only lowercase letters, no special characters, no spaces.
        """
        if value and (not value.islower() or not value.isalnum()):
            raise serializers.ValidationError(
                "Token must contain only lowercase letters and numbers, no special characters or spaces."
            )
        return value


class SurveySerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    response_count = serializers.SerializerMethodField()
    tokens = SurveyTokenSerializer(many=True, read_only=True)

    class Meta:
        model = Survey
        fields = [
            # Basic Info
            'id', 'title', 'description',
            # Template Relationship
            'template',
            # Multilingual Content
            'headlines', 'survey_texts',
            # Project Address
            'city', 'country',
            # Project Token (legacy)
            'token',
            # Project Tokens (new)
            'tokens',
            # Project Details
            'languages', 'format', 'type',
            'start_datetime', 'expiry_date', 'analysis_cluster',
            # End Survey Information
            'start_survey_titles', 'start_survey_texts', 'end_survey_titles', 'end_survey_texts', 'expired_survey_titles', 'expired_survey_texts',
            # Metadata
            'created_by', 'created_at', 'updated_at', 'is_active',
            # Related
            'questions',
            # Stats
            'response_count',
            # Properties
            'primary_token'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'response_count', 'primary_token']
        extra_kwargs = {
            'token': {'required': False, 'allow_blank': True, 'allow_null': True}
        }

    def get_response_count(self, obj):
        """
        Return the number of responses for this survey
        """
        return Response.objects.filter(survey=obj).count()

    def create(self, validated_data):
        # Extract tokens data if present
        tokens_data = self.context.get('request').data.get('tokens', [])
        validated_data['created_by'] = self.context['request'].user

        # Set a dummy value for the legacy token field to avoid issues
        # We're not using this field anymore, but we need to set it to something unique
        import random
        import string
        random_token = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
        validated_data['token'] = random_token

        survey = super().create(validated_data)
        
        # Create tokens if provided
        for token_data in tokens_data:
            SurveyToken.objects.create(
                survey=survey,
                token=token_data.get('token'),
                description=token_data.get('description', 'Token')
            )
        
        return survey

    def validate_languages(self, value):
        """
        Validate that the languages are in the allowed choices
        """
        valid_languages = [lang[0] for lang in Survey.LANGUAGE_CHOICES]
        for lang in value:
            if lang not in valid_languages:
                raise serializers.ValidationError(
                    f"Language '{lang}' is not supported. Valid options are: {', '.join(valid_languages)}"
                )
        return value

    def update(self, instance, validated_data):
        # Set a unique dummy value for the legacy token field
        # We're not using this field anymore, but we need to set it to something unique
        import random
        import string
        random_token = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
        validated_data['token'] = random_token
            
        # Update the survey instance
        survey = super().update(instance, validated_data)
        
        # Handle tokens update if present in the request data
        tokens_data = self.context.get('request').data.get('tokens')
        if tokens_data is not None:
            # First, we'll gather existing token IDs to determine what to keep
            existing_token_ids = set(survey.tokens.values_list('id', flat=True))
            
            # Track the IDs that are updated
            updated_token_ids = set()
            
            # Update existing tokens and create new ones
            for token_data in tokens_data:
                token_id = token_data.get('id')
                
                # If this token has an ID, update the existing record
                if token_id and token_id in existing_token_ids:
                    token = SurveyToken.objects.get(id=token_id)
                    token.token = token_data.get('token', token.token)
                    token.description = token_data.get('description', token.description)
                    token.save()
                    updated_token_ids.add(token_id)
                else:
                    # Create a new token
                    SurveyToken.objects.create(
                        survey=survey,
                        token=token_data.get('token'),
                        description=token_data.get('description', 'Token')
                    )
            
            # Delete tokens that weren't included in the update
            tokens_to_delete = existing_token_ids - updated_token_ids
            if tokens_to_delete:
                SurveyToken.objects.filter(id__in=tokens_to_delete).delete()
        
        return survey


class AnswerSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)
    
    class Meta:
        model = Answer
        fields = ['id', 'question', 'nps_rating', 'text_answer', 'sentiment_score', 'created_at']
        read_only_fields = ['created_at', 'sentiment_score']


class ResponseSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True, read_only=True)
    
    class Meta:
        model = Response
        fields = ['id', 'survey', 'created_at', 'session_id', 'language', 'answers', 'token', 'survey_token']
        read_only_fields = ['created_at']

    def create(self, validated_data):
        # Forward the token (if available) to the model
        token = self.context.get('token')
        if token:
            validated_data['token'] = token
        return super().create(validated_data)


class WordClusterSerializer(serializers.ModelSerializer):
    class Meta:
        model = WordCluster
        fields = [
            'id', 'survey', 'name', 'description', 'sentiment_score', 
            'frequency', 'is_positive', 'is_negative', 'is_neutral', 
            'nps_score', 'custom_cluster_id', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class CustomWordClusterSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    associated_words = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomWordCluster
        fields = [
            'id', 'name', 'description', 'keywords', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'word_count', 'last_processed', 'associated_words'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'created_by_name', 
                          'word_count', 'last_processed', 'associated_words']
        extra_kwargs = {
            'description': {'required': False},
            'keywords': {'required': False, 'default': list},
            'is_active': {'required': False, 'default': True}
        }
    
    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
    
    def get_associated_words(self, obj):
        """Return the top 10 associated words for this cluster"""
        return obj.get_associated_words(limit=10)


class ResponseWordSerializer(serializers.ModelSerializer):
    clusters = WordClusterSerializer(many=True, read_only=True)
    custom_clusters = CustomWordClusterSerializer(many=True, read_only=True)
    
    class Meta:
        model = ResponseWord
        fields = [
            'id', 'response', 'answer', 'word', 'original_text',
            'frequency', 'sentiment_score', 'clusters', 'custom_clusters', 
            'assigned_cluster', 'language', 'created_at'
        ]
        read_only_fields = ['created_at']


class SurveyAnalysisSummarySerializer(serializers.ModelSerializer):
    survey_title = serializers.SerializerMethodField()
    top_clusters_data = serializers.SerializerMethodField()
    top_positive_clusters_data = serializers.SerializerMethodField()
    top_negative_clusters_data = serializers.SerializerMethodField()
    top_neutral_clusters_data = serializers.SerializerMethodField()
    
    class Meta:
        model = SurveyAnalysisSummary
        fields = [
            'id', 'survey', 'survey_title', 'response_count',
            'average_satisfaction', 'median_satisfaction',
            'satisfaction_confidence_low', 'satisfaction_confidence_high',
            'satisfaction_score', 'language_breakdown',
            'positive_percentage', 'negative_percentage', 'neutral_percentage',
            'top_clusters', 'top_clusters_data',
            'top_positive_clusters', 'top_positive_clusters_data',
            'top_negative_clusters', 'top_negative_clusters_data',
            'top_neutral_clusters', 'top_neutral_clusters_data',
            'sentiment_divergence', 'last_updated'
        ]
        read_only_fields = ['last_updated']
    
    def get_survey_title(self, obj):
        return obj.survey.title if obj.survey else ""
    
    def get_top_clusters_data(self, obj):
        cluster_ids = obj.top_clusters
        return self._get_clusters_data(cluster_ids)
        
    def get_top_positive_clusters_data(self, obj):
        cluster_ids = obj.top_positive_clusters
        return self._get_clusters_data(cluster_ids)
        
    def get_top_negative_clusters_data(self, obj):
        cluster_ids = obj.top_negative_clusters
        return self._get_clusters_data(cluster_ids)
        
    def get_top_neutral_clusters_data(self, obj):
        cluster_ids = obj.top_neutral_clusters
        return self._get_clusters_data(cluster_ids)
    
    def _get_clusters_data(self, cluster_ids):
        # Helper method to fetch cluster data from IDs
        from .models import WordCluster, CustomWordCluster, ResponseWord
        
        if not cluster_ids:
            return []
        
        # First check if these are CustomWordCluster IDs
        custom_clusters = list(CustomWordCluster.objects.filter(id__in=cluster_ids))
        
        # If CustomWordCluster models are found, use them
        if custom_clusters:
            # Convert CustomWordCluster to format expected by frontend
            cluster_data_list = []
            for cc in custom_clusters:
                # Get associated response words
                response_words = ResponseWord.objects.filter(custom_clusters=cc)
                
                # Count distinct responses
                distinct_responses = response_words.values('response').distinct().count()
                
                # Calculate average sentiment
                avg_sentiment = response_words.aggregate(models.Avg('sentiment_score'))['sentiment_score__avg'] or 0
                
                # Count NPS ratings
                from .models import Answer
                nps_answers = Answer.objects.filter(
                    response__in=response_words.values('response'),
                    nps_rating__isnull=False
                )
                
                # Calculate average NPS
                avg_nps = None
                if nps_answers.exists():
                    avg_nps = nps_answers.aggregate(models.Avg('nps_rating'))['nps_rating__avg']
                
                # Create a dict representing cluster data
                cluster_data = {
                    'id': cc.id,
                    'name': cc.name,
                    'survey': cc.id,  # Set to cluster ID for consistency
                    'description': cc.description or "",
                    'frequency': distinct_responses,
                    'sentiment_score': avg_sentiment,
                    'nps_score': avg_nps,
                    'is_positive': False,
                    'is_negative': False,
                    'is_neutral': True,
                    'custom_cluster_id': cc.id,
                    'created_at': cc.created_at.isoformat() if cc.created_at else None,
                    'updated_at': cc.updated_at.isoformat() if cc.updated_at else None
                }
                
                # Determine sentiment category
                if avg_nps is not None:
                    if avg_nps >= 9:
                        cluster_data['is_positive'] = True
                        cluster_data['is_neutral'] = False
                    elif avg_nps <= 6:
                        cluster_data['is_negative'] = True
                        cluster_data['is_neutral'] = False
                elif avg_sentiment > 0.3:
                    cluster_data['is_positive'] = True
                    cluster_data['is_neutral'] = False
                elif avg_sentiment < -0.3:
                    cluster_data['is_negative'] = True
                    cluster_data['is_neutral'] = False
                
                cluster_data_list.append(cluster_data)
            
            return sorted(cluster_data_list, key=lambda x: x.get('frequency', 0), reverse=True)
            
        # If no CustomWordCluster models are found, fall back to WordCluster
        clusters = list(WordCluster.objects.filter(id__in=cluster_ids))
        if clusters:
            return WordClusterSerializer(clusters, many=True).data
            
        # If neither is found, return empty list
        return []


class SurveyDetailSerializer(SurveySerializer):
    """
    Serializer for detailed survey view, includes questions.
    """
    questions = QuestionSerializer(many=True)
    
    def create(self, validated_data):
        questions_data = validated_data.pop('questions', [])
        survey = super().create(validated_data)
        
        for order, question_data in enumerate(questions_data, 1):
            # Remove order from question_data if it exists since we're setting it explicitly
            question_data.pop('order', None)
            Question.objects.create(survey=survey, order=order, **question_data)
            
        return survey
        
    def update(self, instance, validated_data):
        questions_data = validated_data.pop('questions', [])
        survey = super().update(instance, validated_data)
        
        # Handle existing questions
        if questions_data:
            # Remove existing questions and create new ones
            instance.questions.all().delete()
            
            for order, question_data in enumerate(questions_data, 1):
                # Remove order from question_data if it exists since we're setting it explicitly
                question_data.pop('order', None)
                Question.objects.create(survey=survey, order=order, **question_data)
                
        return survey


class TemplateSerializer(serializers.ModelSerializer):
    clusters = CustomWordClusterSerializer(many=True, read_only=True)
    questions = TemplateQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Template
        fields = [
            # Basic Info
            'id', 'title', 'description',
            # Multilingual Content
            'headlines', 'survey_texts',
            # Project Details
            'languages', 'format', 'type', 'analysis_cluster',
            # End Survey Information
            'start_survey_titles', 'start_survey_texts', 'end_survey_titles', 'end_survey_texts', 'expired_survey_titles', 'expired_survey_texts',
            # Metadata
            'created_by', 'created_at', 'updated_at', 'is_active',
            # Related
            'clusters', 'questions',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        # Get the current user from the context
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class TemplateDetailSerializer(TemplateSerializer):
    """
    Serializer for detailed template view, allows managing clusters and questions.
    """
    # Override the field to handle both representations of clusters
    clusters = CustomWordClusterSerializer(many=True, required=False)
    questions = TemplateQuestionSerializer(many=True, required=False)
    
    def to_internal_value(self, data):
        """
        Handle both formats of clusters:
        1. List of full cluster objects with IDs
        2. List of cluster IDs
        """
        ret = super().to_internal_value(data)
        
        # Process clusters data if present
        if 'clusters' in data:
            cluster_ids = []
            
            if isinstance(data['clusters'], list):
                for cluster in data['clusters']:
                    if isinstance(cluster, dict) and 'id' in cluster:
                        cluster_ids.append(cluster['id'])
                    elif isinstance(cluster, (int, str)):
                        cluster_ids.append(int(cluster))
            
            if cluster_ids:
                # Get the actual custom cluster objects
                ret['clusters'] = CustomWordCluster.objects.filter(id__in=cluster_ids)
        
        return ret

    def update(self, instance, validated_data):
        # Handle clusters (ManyToMany relationship)
        clusters_data = validated_data.pop('clusters', None)
        
        # Handle questions (nested serializer)
        questions_data = validated_data.pop('questions', None)
        if questions_data is None and 'questions' in self.initial_data:
            # Extract questions data from initial_data if not in validated_data
            questions_data = self.initial_data.get('questions', [])
        
        # Update the template instance with the remaining data
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Set clusters if provided
        if clusters_data is not None:
            print(f"Setting clusters: {clusters_data}")
            instance.clusters.set(clusters_data)
            
        # Update questions if provided
        if questions_data:
            # Delete existing questions
            instance.questions.all().delete()
            
            # Create new questions
            for question_data in questions_data:
                # Ensure we have required fields
                if not isinstance(question_data, dict):
                    continue
                    
                if 'order' not in question_data:
                    question_data['order'] = 1
                if 'type' not in question_data:
                    question_data['type'] = 'free_text'
                if 'questions' not in question_data:
                    question_data['questions'] = {}
                    
                TemplateQuestion.objects.create(template=instance, **question_data)
        
        return instance


class SurveyWithTemplateSerializer(SurveySerializer):
    template_detail = TemplateSerializer(source='template', read_only=True)
    
    class Meta(SurveySerializer.Meta):
        fields = SurveySerializer.Meta.fields + ['template_detail']

