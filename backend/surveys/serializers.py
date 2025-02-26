from rest_framework import serializers
from .models import Survey, Question, Response, Answer


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = [
            'id', 'questions', 'placeholders', 'type', 'order', 'is_required', 'language', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class SurveySerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    
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
            # Project Token
            'token',
            # Project Details
            'languages', 'format', 'type', 'max_participants',
            'end_date', 'analysis_end_date', 'analysis_cluster',
            # End Survey Information
            'end_survey_titles', 'expired_survey_titles', 'expired_survey_texts',
            # Metadata
            'created_by', 'created_at', 'updated_at', 'is_active',
            # Related
            'questions'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)

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


class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ['id', 'question', 'nps_rating', 'text_answer', 'sentiment_score', 'created_at']
        read_only_fields = ['created_at', 'sentiment_score']


class ResponseSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True)
    
    class Meta:
        model = Response
        fields = ['id', 'survey', 'created_at', 'session_id', 'language', 'answers']
        read_only_fields = ['created_at']

    def create(self, validated_data):
        answers_data = validated_data.pop('answers')
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

