from rest_framework import serializers
from .models import Survey, Question, Response, Answer, SurveyToken


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
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
            # Multilingual Content
            'headlines', 'survey_texts',
            # Project Information
            'building_name', 'short_id', 'project_description',
            # Project Address
            'street_number', 'city_code', 'city', 'country',
            # Project Token (legacy)
            'token',
            # Project Tokens (new)
            'tokens',
            # Project Details
            'languages', 'format', 'type', 'max_participants',
            'expiry_date', 'analysis_end_date', 'analysis_cluster',
            # End Survey Information
            'end_survey_titles', 'end_survey_texts', 'expired_survey_titles', 'expired_survey_texts',
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

    def get_response_count(self, obj):
        """
        Return the number of responses for this survey
        """
        return Response.objects.filter(survey=obj).count()

    def create(self, validated_data):
        # Extract tokens data if present
        tokens_data = self.context.get('request').data.get('tokens', [])
        validated_data['created_by'] = self.context['request'].user
        survey = super().create(validated_data)
        
        # Create tokens if provided
        for token_data in tokens_data:
            SurveyToken.objects.create(
                survey=survey,
                token=token_data.get('token'),
                description=token_data.get('description', 'Token')
            )
        
        return survey

    def validate_token(self, value):
        """
        Check that the token contains only lowercase letters, no special characters, no spaces.
        """
        if value and (not value.islower() or not value.isalnum()):
            raise serializers.ValidationError(
                "Token must contain only lowercase letters and numbers, no special characters or spaces."
            )
        return value

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
        answers_data = validated_data.pop('answers', [])
        response = Response.objects.create(**validated_data)
        
        for answer_data in answers_data:
            Answer.objects.create(response=response, **answer_data)
        
        return response


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

