from rest_framework import serializers
from .models import Survey, Question, Response, Answer, SurveyToken, WordCluster, ResponseWord, SurveyAnalysisSummary, CustomWordCluster, Template, TemplateQuestion
from django.db import models
import logging
from django.db import transaction
import json

logger = logging.getLogger(__name__)


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
            'token': {'required': False, 'allow_blank': True, 'allow_null': True},
            'template': {'required': False, 'allow_null': True}
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

        if len(tokens_data) == 0:
            random_token = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
            
            validated_data['token'] = random_token
        
        else:
            validated_data['token'] = tokens_data[0].get('token')
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
        """
        Update a survey and its related questions.
        This method handles several complex scenarios:
        1. Updates survey fields
        2. Updates, creates, or deletes questions based on the provided data
        3. Preserves answers when deleting questions that have answers
        """
        from django.db import transaction

        # Debug: Print the raw request data to see what's being sent
        request_data = self.context.get('request').data
        logger.info(f"Survey {instance.id} update: Raw request data keys: {list(request_data.keys())}")
        
        if 'questions' in request_data:
            logger.info(f"Survey {instance.id} update: Raw questions data length: {len(request_data['questions'])}")
            # Print a sample of the first question
            if len(request_data['questions']) > 0:
                logger.info(f"Survey {instance.id} update: First question sample: {json.dumps(request_data['questions'][0], indent=2)}")
        else:
            logger.info(f"Survey {instance.id} update: No 'questions' key in raw request data")

        # Extract questions data before updating main survey
        questions_data = validated_data.pop('questions', None)

        print("Questions Data:")
        print(questions_data)
        
        # Debug: Print what's in validated_data
        logger.info(f"Survey {instance.id} update: validated_data keys: {list(validated_data.keys())}")
        
        # If questions_data is None but exists in the raw request, try to get it from there
        if questions_data is None and 'questions' in request_data:
            logger.info(f"Survey {instance.id} update: questions_data is None but exists in raw request, trying to use that")
            questions_data = request_data['questions']
        
        print("Questions Data:")
        print(questions_data)
        # First update the survey fields
        survey = super().update(instance, validated_data)
        
        # IMPORTANT: If questions_data is None (not provided), don't modify existing questions
        # This is to prevent accidental deletion of all questions
        if questions_data is None:
            logger.info(f"Survey {survey.id} update: No questions data provided, keeping existing questions")
            return survey
            
        logger.info(f"Survey {survey.id} update: Processing {len(questions_data)} questions")
        
        # Get existing questions
        existing_questions = list(instance.questions.all().order_by('order'))
        
        # Store IDs as integers for consistent comparison
        # Create a mapping of existing question objects by their ID for direct access
        existing_question_ids = set()
        existing_questions_by_id = {}
        for q in existing_questions:
            if q.id is not None:
                q_id = int(q.id)
                existing_question_ids.add(q_id)
                existing_questions_by_id[q_id] = q
        
        existing_question_count = len(existing_questions)
        
        logger.info(f"Survey {survey.id} update: Found {existing_question_count} existing questions with IDs: {existing_question_ids}")
        
        # Check if the incoming question data contains any IDs at all
        any_questions_have_ids = False
        for q_data in questions_data:
            if 'id' in q_data and q_data['id'] is not None:
                any_questions_have_ids = True
                break
                
        logger.info(f"Survey {survey.id} update: Incoming questions have IDs: {any_questions_have_ids}")
        
        # Process the incoming question data for better debugging
        incoming_questions_info = []
        for i, q_data in enumerate(questions_data):
            q_id = q_data.get('id')
            q_id_str = str(q_id) if q_id is not None else 'NEW'
            q_type = q_data.get('type', 'unknown')
            incoming_questions_info.append(f"Q{i+1}: ID={q_id_str}, Type={q_type}")
        
        logger.info(f"Survey {survey.id} update: Incoming questions: {', '.join(incoming_questions_info)}")
        
        # Check which questions have answers
        questions_with_answers = set(
            Answer.objects.filter(question__in=existing_questions)
            .values_list('question_id', flat=True)
            .distinct()
        )
        
        logger.info(f"Survey {survey.id} update: Questions with answers: {questions_with_answers}")
        
        # We'll use a transaction to ensure all changes happen together or not at all
        with transaction.atomic():
            # If it's an exact replacement of all questions (same count, no IDs provided)
            # OR if no questions have IDs at all, use in-place updating to preserve IDs
            if (len(questions_data) == existing_question_count and 
                (not any_questions_have_ids or not any('id' in q and q['id'] is not None for q in questions_data))):
                
                logger.info(f"Survey {survey.id} update: Using in-place update strategy (count: {existing_question_count}, no IDs sent)")
                
                # Update existing questions in place based on order
                for i, (question, question_data) in enumerate(zip(existing_questions, questions_data)):
                    # Remove order from data as we're setting it explicitly
                    question_data.pop('order', None)
                    # Remove ID if present to avoid conflicts
                    question_data.pop('id', None)
                    # Update fields
                    for attr, value in question_data.items():
                        setattr(question, attr, value)
                    # Ensure order is maintained
                    question.order = i + 1
                    question.save()
                    logger.info(f"Survey {survey.id} update: Updated question {question.id} in-place at position {i+1}")
                
                # If we have more questions in the incoming data than existing ones, create new ones
                if len(questions_data) > existing_question_count:
                    for i, question_data in enumerate(questions_data[existing_question_count:], existing_question_count + 1):
                        question_data.pop('order', None)
                        question_data.pop('id', None)  # Remove ID if present
                        new_question = Question.objects.create(survey=survey, order=i, **question_data)
                        logger.info(f"Survey {survey.id} update: Created new question ID {new_question.id} at position {i}")
                
                return survey
            
            # If we get here, at least some questions have IDs, so we'll use the standard update/create/delete logic
            logger.info(f"Survey {survey.id} update: Using standard update logic (some questions have IDs)")
            
            # Track which question IDs are in the updated data
            updated_question_ids = set()
            
            # First pass: Update existing questions or create new ones
            for order, question_data in enumerate(questions_data, 1):
                question_id = question_data.pop('id', None)
                question_data.pop('order', None)  # We'll set order explicitly
                
                # Convert ID to integer for comparison if it's not None
                original_id = question_id  # Keep original for logging
                if question_id is not None:
                    try:
                        question_id = int(question_id)
                    except (ValueError, TypeError):
                        # If conversion fails, treat as a new question
                        logger.warning(f"Survey {survey.id} update: Could not convert question ID {original_id} to integer, treating as new question")
                        question_id = None
                
                # Debug logging for each question processed
                logger.info(f"Survey {survey.id} update: Processing question at position {order} with ID {question_id} (original: {original_id})")
                
                if question_id is not None and question_id in existing_question_ids:
                    # Update existing question directly from our mapping
                    question = existing_questions_by_id[question_id]
                    for attr, value in question_data.items():
                        setattr(question, attr, value)
                    question.order = order
                    question.save()
                    updated_question_ids.add(question_id)
                    logger.info(f"Survey {survey.id} update: Updated existing question ID {question_id}")
                else:
                    # Create new question
                    new_question = Question.objects.create(survey=survey, order=order, **question_data)
                    logger.info(f"Survey {survey.id} update: Created new question ID {new_question.id}")
            
            # Calculate which questions were NOT included in the update (for deletion)
            questions_to_delete = existing_question_ids - updated_question_ids
            
            # Debug logging for deletion
            logger.info(f"Survey {survey.id} update: Questions marked for deletion: {questions_to_delete}")
            
            if questions_to_delete:
                # Check if we need to handle questions with answers
                questions_to_delete_with_answers = questions_to_delete.intersection(questions_with_answers)
                questions_to_delete_without_answers = questions_to_delete - questions_with_answers
                
                # Log what we're doing for debugging
                logger.info(f"Survey {survey.id} update: Deleting questions without answers: {questions_to_delete_without_answers}")
                logger.info(f"Survey {survey.id} update: Handling questions with answers: {questions_to_delete_with_answers}")
                
                # Delete questions without answers normally
                if questions_to_delete_without_answers:
                    deleted_count = Question.objects.filter(id__in=questions_to_delete_without_answers).delete()[0]
                    logger.info(f"Survey {survey.id} update: Deleted {deleted_count} questions without answers")
                
                # Special handling for questions with answers: remove the question_id reference from answers
                if questions_to_delete_with_answers:
                    # For each question with answers that needs to be deleted:
                    # 1. Find all answers for this question
                    # 2. Set question_id to NULL for affected answers to preserve the answer data
                    # 3. Then delete the question
                    for question_id in questions_to_delete_with_answers:
                        # Get the answers for this question
                        answers = Answer.objects.filter(question_id=question_id)
                        answer_count = answers.count()
                        
                        # Set question_id to NULL for affected answers to preserve the answer data
                        # Our model has on_delete=SET_NULL and null=True
                        update_count = Answer.objects.filter(question_id=question_id).update(question=None)
                        
                        # Now we can safely delete the question
                        delete_count = Question.objects.filter(id=question_id).delete()[0]
                        
                        # Log the operation
                        logger.info(f"Survey {survey.id} update: Preserved {update_count}/{answer_count} answers while deleting question {question_id} (deleted: {delete_count})")
        
        return survey


class AnswerSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)
    
    class Meta:
        model = Answer
        fields = ['id', 'question', 'nps_rating', 'text_answer', 'sentiment_score', 'created_at', 'sentence_sentiments']
        read_only_fields = ['created_at', 'sentiment_score', 'sentence_sentiments']


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
            'word_count', 'last_processed', 'associated_words',
            # Add new multi-language fields
            'names', 'descriptions', 'multilingual_keywords'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'created_by_name', 
                          'word_count', 'last_processed', 'associated_words']
        extra_kwargs = {
            'description': {'required': False},
            'keywords': {'required': False, 'default': list},
            'is_active': {'required': False, 'default': True},
            # Add new multi-language fields as not required
            'names': {'required': False, 'default': dict},
            'descriptions': {'required': False, 'default': dict},
            'multilingual_keywords': {'required': False, 'default': dict}
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
        """Helper method to fetch cluster data from IDs."""
        if not cluster_ids:
            return []
            
        # First check if we have metrics data for these clusters
        metrics = self.instance.metrics.get('cluster_metrics', {}) if hasattr(self.instance, 'metrics') else {}
        
        # If we have metrics for at least some clusters, use that data
        if metrics:
            # Create data directly from stored metrics
            cluster_data_list = []
            
            for cluster_id in cluster_ids:
                # Convert to string since JSON keys are strings
                str_cluster_id = str(cluster_id)
                
                # If we have metrics for this cluster, use them
                if str_cluster_id in metrics:
                    cluster_metric = metrics[str_cluster_id]
                    
                    # Create a dict representing cluster data
                    cluster_data = {
                        'id': cluster_id,
                        'name': cluster_metric.get('name', 'Unknown'),
                        'survey': self.instance.survey_id,
                        'description': cluster_metric.get('description', ''),
                        'frequency': cluster_metric.get('frequency', 0),
                        'response_count': cluster_metric.get('response_count', 0),
                        'sentiment_score': cluster_metric.get('sentiment_score', 0),
                        'nps_score': cluster_metric.get('nps_score'),
                        'is_positive': cluster_metric.get('is_positive', False),
                        'is_negative': cluster_metric.get('is_negative', False),
                        'is_neutral': cluster_metric.get('is_neutral', True),
                        'custom_cluster_id': cluster_id,
                    }
                    cluster_data_list.append(cluster_data)
            
            # If we found metrics data for all clusters, return it
            if cluster_data_list and len(cluster_data_list) == len(cluster_ids):
                return sorted(cluster_data_list, key=lambda x: x.get('frequency', 0), reverse=True)
        
        # Fall back to original behavior if metrics aren't available
        from .models import WordCluster, CustomWordCluster, ResponseWord
        
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

    def get_clusters(self, obj):
        from .models import CustomWordCluster
        from django.db.models import Count, Avg, Q
        
        cluster_ids = obj.top_clusters or []
        if not cluster_ids:
            return []
        
        # Get CustomWordCluster models
        custom_clusters = list(CustomWordCluster.objects.filter(id__in=cluster_ids))
        if custom_clusters:
            # Populate fields as needed
            cluster_data_list = []
            for cc in custom_clusters:
                cluster_data = {
                    'id': cc.id,
                    'name': cc.name,
                    'description': cc.description or '',
                    'frequency': 0,  # Will be populated from survey data if possible
                    'sentiment_score': 0,
                    'is_positive': False,
                    'is_negative': False,
                    'is_neutral': True,
                    'custom_cluster_id': cc.id,
                }
                cluster_data_list.append(cluster_data)
            
            return sorted(cluster_data_list, key=lambda x: x.get('frequency', 0), reverse=True)
            
        # If no clusters found, return empty list
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
        """
        Update a survey and its related questions.
        This method handles several complex scenarios:
        1. Updates survey fields
        2. Updates, creates, or deletes questions based on the provided data
        3. Preserves answers when deleting questions that have answers
        """
        from django.db import transaction

        # Extract questions data before updating main survey
        questions_data = validated_data.pop('questions', None)
        
        # First update the survey fields
        survey = super().update(instance, validated_data)
        
        # IMPORTANT: If questions_data is None (not provided), don't modify existing questions
        # This is to prevent accidental deletion of all questions
        if questions_data is None:
            logger.info(f"Survey {survey.id} update: No questions data provided, keeping existing questions")
            return survey
            
        logger.info(f"Survey {survey.id} update: Processing {len(questions_data)} questions")
        
        # Get existing questions
        existing_questions = list(instance.questions.all().order_by('order'))
        
        # Store IDs as integers for consistent comparison
        # Create a mapping of existing question objects by their ID for direct access
        existing_question_ids = set()
        existing_questions_by_id = {}
        for q in existing_questions:
            if q.id is not None:
                q_id = int(q.id)
                existing_question_ids.add(q_id)
                existing_questions_by_id[q_id] = q
        
        existing_question_count = len(existing_questions)
        
        logger.info(f"Survey {survey.id} update: Found {existing_question_count} existing questions with IDs: {existing_question_ids}")
        
        # Check if the incoming question data contains any IDs at all
        any_questions_have_ids = False
        for q_data in questions_data:
            if 'id' in q_data and q_data['id'] is not None:
                any_questions_have_ids = True
                break
                
        logger.info(f"Survey {survey.id} update: Incoming questions have IDs: {any_questions_have_ids}")
        
        # Process the incoming question data for better debugging
        incoming_questions_info = []
        for i, q_data in enumerate(questions_data):
            q_id = q_data.get('id')
            q_id_str = str(q_id) if q_id is not None else 'NEW'
            q_type = q_data.get('type', 'unknown')
            incoming_questions_info.append(f"Q{i+1}: ID={q_id_str}, Type={q_type}")
        
        logger.info(f"Survey {survey.id} update: Incoming questions: {', '.join(incoming_questions_info)}")
        
        # Check which questions have answers
        questions_with_answers = set(
            Answer.objects.filter(question__in=existing_questions)
            .values_list('question_id', flat=True)
            .distinct()
        )
        
        logger.info(f"Survey {survey.id} update: Questions with answers: {questions_with_answers}")
        
        # We'll use a transaction to ensure all changes happen together or not at all
        with transaction.atomic():
            # If it's an exact replacement of all questions (same count, no IDs provided)
            # OR if no questions have IDs at all, use in-place updating to preserve IDs
            if (len(questions_data) == existing_question_count and 
                (not any_questions_have_ids or not any('id' in q and q['id'] is not None for q in questions_data))):
                
                logger.info(f"Survey {survey.id} update: Using in-place update strategy (count: {existing_question_count}, no IDs sent)")
                
                # Update existing questions in place based on order
                for i, (question, question_data) in enumerate(zip(existing_questions, questions_data)):
                    # Remove order from data as we're setting it explicitly
                    question_data.pop('order', None)
                    # Remove ID if present to avoid conflicts
                    question_data.pop('id', None)
                    # Update fields
                    for attr, value in question_data.items():
                        setattr(question, attr, value)
                    # Ensure order is maintained
                    question.order = i + 1
                    question.save()
                    logger.info(f"Survey {survey.id} update: Updated question {question.id} in-place at position {i+1}")
                
                # If we have more questions in the incoming data than existing ones, create new ones
                if len(questions_data) > existing_question_count:
                    for i, question_data in enumerate(questions_data[existing_question_count:], existing_question_count + 1):
                        question_data.pop('order', None)
                        question_data.pop('id', None)  # Remove ID if present
                        new_question = Question.objects.create(survey=survey, order=i, **question_data)
                        logger.info(f"Survey {survey.id} update: Created new question ID {new_question.id} at position {i}")
                
                return survey
            
            # If we get here, at least some questions have IDs, so we'll use the standard update/create/delete logic
            logger.info(f"Survey {survey.id} update: Using standard update logic (some questions have IDs)")
            
            # Track which question IDs are in the updated data
            updated_question_ids = set()
            
            # First pass: Update existing questions or create new ones
            for order, question_data in enumerate(questions_data, 1):
                question_id = question_data.pop('id', None)
                question_data.pop('order', None)  # We'll set order explicitly
                
                # Convert ID to integer for comparison if it's not None
                original_id = question_id  # Keep original for logging
                if question_id is not None:
                    try:
                        question_id = int(question_id)
                    except (ValueError, TypeError):
                        # If conversion fails, treat as a new question
                        logger.warning(f"Survey {survey.id} update: Could not convert question ID {original_id} to integer, treating as new question")
                        question_id = None
                
                # Debug logging for each question processed
                logger.info(f"Survey {survey.id} update: Processing question at position {order} with ID {question_id} (original: {original_id})")
                
                if question_id is not None and question_id in existing_question_ids:
                    # Update existing question directly from our mapping
                    question = existing_questions_by_id[question_id]
                    for attr, value in question_data.items():
                        setattr(question, attr, value)
                    question.order = order
                    question.save()
                    updated_question_ids.add(question_id)
                    logger.info(f"Survey {survey.id} update: Updated existing question ID {question_id}")
                else:
                    # Create new question
                    new_question = Question.objects.create(survey=survey, order=order, **question_data)
                    logger.info(f"Survey {survey.id} update: Created new question ID {new_question.id}")
            
            # Calculate which questions were NOT included in the update (for deletion)
            questions_to_delete = existing_question_ids - updated_question_ids
            
            # Debug logging for deletion
            logger.info(f"Survey {survey.id} update: Questions marked for deletion: {questions_to_delete}")
            
            if questions_to_delete:
                # Check if we need to handle questions with answers
                questions_to_delete_with_answers = questions_to_delete.intersection(questions_with_answers)
                questions_to_delete_without_answers = questions_to_delete - questions_with_answers
                
                # Log what we're doing for debugging
                logger.info(f"Survey {survey.id} update: Deleting questions without answers: {questions_to_delete_without_answers}")
                logger.info(f"Survey {survey.id} update: Handling questions with answers: {questions_to_delete_with_answers}")
                
                # Delete questions without answers normally
                if questions_to_delete_without_answers:
                    deleted_count = Question.objects.filter(id__in=questions_to_delete_without_answers).delete()[0]
                    logger.info(f"Survey {survey.id} update: Deleted {deleted_count} questions without answers")
                
                # Special handling for questions with answers: remove the question_id reference from answers
                if questions_to_delete_with_answers:
                    # For each question with answers that needs to be deleted:
                    # 1. Find all answers for this question
                    # 2. Set question_id to NULL for affected answers to preserve the answer data
                    # 3. Then delete the question
                    for question_id in questions_to_delete_with_answers:
                        # Get the answers for this question
                        answers = Answer.objects.filter(question_id=question_id)
                        answer_count = answers.count()
                        
                        # Set question_id to NULL for affected answers to preserve the answer data
                        # Our model has on_delete=SET_NULL and null=True
                        update_count = Answer.objects.filter(question_id=question_id).update(question=None)
                        
                        # Now we can safely delete the question
                        delete_count = Question.objects.filter(id=question_id).delete()[0]
                        
                        # Log the operation
                        logger.info(f"Survey {survey.id} update: Preserved {update_count}/{answer_count} answers while deleting question {question_id} (deleted: {delete_count})")
                
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

    def create(self, validated_data):
        # Extract nested data
        clusters_data = validated_data.pop('clusters', None)
        questions_data = validated_data.pop('questions', [])
        
        # Create the template instance
        template = super().create(validated_data)
        
        # Set clusters if provided
        if clusters_data is not None:
            template.clusters.set(clusters_data)
            
        # Create questions if provided
        if questions_data:
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
                
                TemplateQuestion.objects.create(template=template, **question_data)
        
        return template

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

