from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from django.db.models import Count, Avg, Q, F, Sum
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import User, Group
from collections import Counter
from .models import Survey, Question, Response, Answer, SurveyToken, WordCluster, ResponseWord, SurveyAnalysisSummary, CustomWordCluster
from .serializers import (
    SurveySerializer, 
    SurveyDetailSerializer,
    QuestionSerializer, 
    ResponseSerializer, 
    AnswerSerializer,
    SurveyTokenSerializer,
    WordClusterSerializer,
    ResponseWordSerializer,
    SurveyAnalysisSummarySerializer,
    CustomWordClusterSerializer
)
from django.http import HttpResponse
import qrcode
from io import BytesIO
from django.db import transaction
import logging
from django.db.models.functions import Cast
import numpy as np
from .utils import TextAnalyzer, cluster_responses, calculate_stats_from_scores, calculate_satisfaction_score

logger = logging.getLogger(__name__)


class IsCreatorOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        # Must be authenticated
        if not request.user.is_authenticated:
            return False
            
        # Admin and Organizer have full access
        if request.user.groups.filter(name__in=['Admin', 'Organizer']).exists():
            return True
            
        # Moderator can create surveys and access their own
        if request.user.groups.filter(name='Moderator').exists():
            return True
            
        # For GET requests, allow if survey is active (for participants)
        if request.method in permissions.SAFE_METHODS:
            return True
            
        return False

    def has_object_permission(self, request, view, obj):
        # Admin and Organizer have full access
        if request.user.groups.filter(name__in=['Admin', 'Organizer']).exists():
            return True
            
        # Moderator can only view and edit (but not delete) their own surveys
        if request.user.groups.filter(name='Moderator').exists():
            if request.method == 'DELETE':
                return False
            return obj.created_by == request.user
            
        # For GET requests, allow if survey is active (for participants)
        if request.method in permissions.SAFE_METHODS:
            return obj.is_active
            
        return False


class SurveyViewSet(viewsets.ModelViewSet):
    queryset = Survey.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsCreatorOrReadOnly]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update', 'retrieve', 'public']:
            return SurveyDetailSerializer
        return SurveySerializer
    
    def get_queryset(self):
        queryset = Survey.objects.all()
        
        # Admin and Organizer can see all surveys
        if self.request.user.groups.filter(name__in=['Admin', 'Organizer']).exists():
            pass
        # Moderator can only see their own surveys
        elif self.request.user.groups.filter(name='Moderator').exists():
            queryset = queryset.filter(created_by=self.request.user)
        # Others (participants) can only see active surveys
        else:
            queryset = queryset.filter(is_active=True)
        
        # Filter by creator if requested
        created_by = self.request.query_params.get('created_by', None)
        if created_by and created_by == 'me':
            queryset = queryset.filter(created_by=self.request.user)
            
        # Filter by language if requested
        language = self.request.query_params.get('language', None)
        if language:
            queryset = queryset.filter(languages__contains=[language])
            
        # Search by title or description
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | 
                Q(description__icontains=search) |
                Q(short_id__icontains=search)
            )
            
        return queryset.order_by('-created_at')
    
    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        survey = self.get_object()
        
        # Get number of responses
        total_responses = Response.objects.filter(survey=survey).count()
        
        # Get responses by language
        responses_by_language = Response.objects.filter(survey=survey).values('language').annotate(count=Count('id'))
        
        # Calculate average NPS score
        nps_avg = Answer.objects.filter(
            question__survey=survey,
            question__type='nps',
            nps_rating__isnull=False
        ).aggregate(avg_score=Avg('nps_rating'))['avg_score'] or 0
        
        # Calculate NPS categories
        nps_answers = Answer.objects.filter(
            question__survey=survey,
            question__type='nps',
            nps_rating__isnull=False
        )
        
        total_nps = nps_answers.count()
        promoters = nps_answers.filter(nps_rating__gte=9).count()
        detractors = nps_answers.filter(nps_rating__lte=6).count()
        
        nps_score = 0
        if total_nps > 0:
            nps_score = ((promoters / total_nps) - (detractors / total_nps)) * 100
        
        # Calculate completion rate
        completion_rate = self.calculate_completion_rate(survey)
        
        return DRFResponse({
            'total_responses': total_responses,
            'responses_by_language': list(responses_by_language),
            'nps_average': round(nps_avg, 1),
            'nps_score': round(nps_score, 1),
            'completion_rate': round(completion_rate, 1),
            'promoters': promoters,
            'detractors': detractors,
            'passives': total_nps - promoters - detractors
        })
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny], url_path='public')
    def public(self, request):
        token = request.query_params.get('token')
        
        if not token:
            return DRFResponse({'detail': 'Token is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            # Find survey by token - looking at both legacy token field and SurveyToken model
            try:
                # First try to find a survey using the SurveyToken model
                survey_token = SurveyToken.objects.get(token=token)
                survey = survey_token.survey
            except SurveyToken.DoesNotExist:
                # If not found, try the legacy token field
                survey = Survey.objects.get(token=token)
            
            serializer = SurveyDetailSerializer(survey)
            survey_data = serializer.data
            
            # Check if survey is active and not expired
            if not survey.is_active:
                return DRFResponse({
                    'detail': 'This survey is no longer active',
                    'survey': survey_data,
                    'status': 'inactive'
                }, status=status.HTTP_400_BAD_REQUEST)
                
            # Check if survey has expired
            if survey.expiry_date and survey.expiry_date < timezone.now():
                return DRFResponse({
                    'detail': 'This survey has expired',
                    'survey': survey_data,
                    'status': 'expired'
                }, status=status.HTTP_400_BAD_REQUEST)
                
            # Check if survey has reached max participants
            current_responses = Response.objects.filter(survey=survey).count()
            if survey.max_participants and current_responses >= survey.max_participants:
                return DRFResponse({
                    'detail': 'This survey has reached its maximum number of participants',
                    'survey': survey_data,
                    'status': 'full'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            return DRFResponse(survey_data)
            
        except (Survey.DoesNotExist, SurveyToken.DoesNotExist):
            return DRFResponse({'detail': 'Survey not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def qr_code_data(self, request, pk=None):
        survey = self.get_object()
        
        # Check if survey has any tokens
        token_objects = survey.tokens.all()
        if not token_objects.exists() and not survey.token:
            return DRFResponse(
                {"error": "Survey does not have any tokens"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        base_url = request.build_absolute_uri('/')[:-1]  # Remove trailing slash
        
        # Get all token data including legacy token if present
        token_data = []
        
        # Add SurveyToken objects
        for token_obj in token_objects:
            token_data.append({
                'id': token_obj.id,
                'token': token_obj.token,
                'description': token_obj.description,
                'survey_url': f"{base_url}/survey/{token_obj.token}",
                'qr_code_url': f"{base_url}/api/surveys/surveys/token/{token_obj.token}/qr_code/"
            })
        
        # If there's a legacy token, include it too
        if survey.token and not token_objects.filter(token=survey.token).exists():
            token_data.append({
                'id': None,
                'token': survey.token,
                'description': 'Legacy Token',
                'survey_url': f"{base_url}/survey/{survey.token}",
                'qr_code_url': f"{base_url}/api/surveys/surveys/token/{survey.token}/qr_code/"
            })
        
        # If no tokens exist, return error
        if not token_data:
            return DRFResponse(
                {"error": "Survey does not have any tokens"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Return all token data
        return DRFResponse({
            'tokens': token_data,
            'primary_token': survey.primary_token
        })

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny], url_path='token/(?P<token>[^/.]+)/qr_code')
    def token_qr_code(self, request, token=None):
        """Generate QR code for a specific token"""
        if not token:
            return DRFResponse({'detail': 'Token is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Find survey by token - looking at both legacy token field and SurveyToken model
            try:
                # First try to find a survey using the SurveyToken model
                survey_token = SurveyToken.objects.get(token=token)
                survey = survey_token.survey
            except SurveyToken.DoesNotExist:
                # If not found, try the legacy token field
                survey = Survey.objects.get(token=token)
            
            # Generate the URL for the public survey
            base_url = request.build_absolute_uri('/').rstrip('/')
            survey_url = f"{base_url}/api/surveys/public?token={token}"
            
            # Generate QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            
            qr.add_data(survey_url)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Save QR code to BytesIO object
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            buffer.seek(0)
            
            # Return the image
            return HttpResponse(buffer.getvalue(), content_type="image/png")
            
        except (Survey.DoesNotExist, SurveyToken.DoesNotExist):
            return DRFResponse({'detail': 'Survey not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'], permission_classes=[permissions.AllowAny])
    def qr_code(self, request, pk=None):
        """Legacy endpoint for backward compatibility - uses the primary token"""
        try:
            survey = self.get_object()
            
            # Get the primary token
            primary_token = survey.primary_token
            
            if not primary_token:
                return DRFResponse({'detail': 'This survey does not have a token for public access'}, status=status.HTTP_400_BAD_REQUEST)
                
            # Generate the URL for the public survey
            base_url = request.build_absolute_uri('/').rstrip('/')
            survey_url = f"{base_url}/api/surveys/public?token={primary_token}"
            
            # Generate QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            
            qr.add_data(survey_url)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Save QR code to BytesIO object
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            buffer.seek(0)
            
            # Return the image
            return HttpResponse(buffer.getvalue(), content_type="image/png")
            
        except Survey.DoesNotExist:
            return DRFResponse({'detail': 'Survey not found'}, status=status.HTTP_404_NOT_FOUND)

    # New endpoint for managing tokens
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def add_token(self, request, pk=None):
        """Add a new token to the survey"""
        survey = self.get_object()
        
        # Validate token data
        serializer = SurveyTokenSerializer(data=request.data)
        if serializer.is_valid():
            # Check if token already exists
            token = serializer.validated_data['token']
            if SurveyToken.objects.filter(token=token).exists() or Survey.objects.filter(token=token).exclude(id=survey.id).exists():
                return DRFResponse({'detail': 'Token already exists'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Create the token
            serializer.save(survey=survey)
            return DRFResponse(serializer.data, status=status.HTTP_201_CREATED)
        
        return DRFResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['delete'], permission_classes=[permissions.IsAuthenticated], url_path='token/(?P<token_id>\d+)')
    def delete_token(self, request, pk=None, token_id=None):
        """Delete a token from the survey"""
        survey = self.get_object()
        
        try:
            token = SurveyToken.objects.get(id=token_id, survey=survey)
            
            # Check if this is the only token
            if survey.tokens.count() <= 1:
                return DRFResponse({'detail': 'Cannot delete the only token. Surveys must have at least one token.'}, 
                                  status=status.HTTP_400_BAD_REQUEST)
            
            token.delete()
            return DRFResponse(status=status.HTTP_204_NO_CONTENT)
        
        except SurveyToken.DoesNotExist:
            return DRFResponse({'detail': 'Token not found'}, status=status.HTTP_404_NOT_FOUND)

    def calculate_completion_rate(self, survey):
        total_starts = Response.objects.filter(survey=survey).count()
        if total_starts == 0:
            return 0
        
        # Count responses that have answers for all required questions
        required_questions = Question.objects.filter(survey=survey, is_required=True).count()
        
        if required_questions == 0:
            return 100
        
        completed = 0
        for response in Response.objects.filter(survey=survey):
            answer_count = Answer.objects.filter(
                response=response, 
                question__is_required=True
            ).count()
            
            if answer_count >= required_questions:
                completed += 1
        
        return (completed / total_starts) * 100

    def perform_destroy(self, instance):
        # Additional check for delete permission
        if self.request.user.groups.filter(name='Moderator').exists():
            raise permissions.PermissionDenied("Moderators cannot delete surveys")
        super().perform_destroy(instance)


class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [permissions.IsAuthenticated, IsCreatorOrReadOnly]

    def get_queryset(self):
        queryset = Question.objects.all()
        
        # Admin and Organizer can see all questions
        if self.request.user.groups.filter(name__in=['Admin', 'Organizer']).exists():
            pass
        # Moderator can only see questions from their surveys
        elif self.request.user.groups.filter(name='Moderator').exists():
            queryset = queryset.filter(survey__created_by=self.request.user)
        # Others can only see questions from active surveys
        else:
            queryset = queryset.filter(survey__is_active=True)
        
        # Filter by survey if requested
        survey_id = self.request.query_params.get('survey', None)
        if survey_id is not None:
            queryset = queryset.filter(survey_id=survey_id)
            
        # Filter by language if requested
        language = self.request.query_params.get('language', None)
        if language is not None:
            queryset = queryset.filter(language=language)
            
        return queryset.order_by('order')

    def perform_create(self, serializer):
        survey_id = self.request.data.get('survey')
        if survey_id:
            survey = Survey.objects.get(id=survey_id)
            # Check if user has permission to add questions
            if not self.request.user.groups.filter(name__in=['Admin', 'Organizer']).exists():
                if survey.created_by != self.request.user:
                    raise permissions.PermissionDenied("You don't have permission to add questions to this survey.")
        serializer.save()

    def perform_destroy(self, instance):
        # Moderators cannot delete questions
        if self.request.user.groups.filter(name='Moderator').exists():
            raise permissions.PermissionDenied("Moderators cannot delete questions")
        super().perform_destroy(instance)


class ResponseViewSet(viewsets.ModelViewSet):
    queryset = Response.objects.all()
    serializer_class = ResponseSerializer
    permission_classes = [permissions.AllowAny]  # Allow public submissions

    def get_queryset(self):
        queryset = Response.objects.all()
        
        # Only show responses for surveys created by the current user if they're not an admin
        if not self.request.user.is_staff and self.request.user.is_authenticated:
            queryset = queryset.filter(survey__created_by=self.request.user)
            
        survey_id = self.request.query_params.get('survey', None)
        if survey_id is not None:
            queryset = queryset.filter(survey_id=survey_id)
            
        language = self.request.query_params.get('language', None)
        if language is not None:
            queryset = queryset.filter(language=language)
            
        return queryset.order_by('-created_at')

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def submit_response(self, request):
        survey_id = request.data.get('survey')
        language = request.data.get('language', 'en')
        answers_data = request.data.get('answers', [])
        token = request.data.get('token')  # Get the token from the request
        
        # Log request data for debugging
        logger.info(f"Submit response request data: {request.data}")
        logger.info(f"Token received in request: {token}")
        
        try:
            survey = Survey.objects.get(id=survey_id)
        except Survey.DoesNotExist:
            return DRFResponse({'detail': 'Survey not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if the selected language is available for this survey
        if language not in survey.languages:
            return DRFResponse(
                {'detail': f'This survey is not available in {language}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if survey is active
        if not survey.is_active:
            return DRFResponse({'detail': 'This survey is no longer active'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if survey has reached max participants
        current_responses = Response.objects.filter(survey=survey).count()
        if survey.max_participants and current_responses >= survey.max_participants:
            return DRFResponse({'detail': 'This survey has reached its maximum number of participants'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if survey has expired
        if survey.expiry_date and survey.expiry_date < timezone.now():
            return DRFResponse({'detail': 'This survey has expired'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate a session ID if not provided
        session_id = request.data.get('session_id')
        if not session_id:
            import uuid
            session_id = str(uuid.uuid4())
        
        # Find SurveyToken if it exists
        survey_token = None
        if token:
            try:
                survey_token = SurveyToken.objects.get(token=token, survey=survey)
            except SurveyToken.DoesNotExist:
                # If not found in SurveyToken model, check if it matches the legacy token
                if survey.token == token:
                    # It's a legacy token
                    pass
                else:
                    # Invalid token
                    return DRFResponse({'detail': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create response with token information
        response = Response.objects.create(
            survey=survey, 
            session_id=session_id, 
            language=language,
            token=token,
            survey_token=survey_token
        )
        
        # Process the answers
        required_questions = set(Question.objects.filter(survey=survey, is_required=True).values_list('id', flat=True))
        answered_required = set()
        
        logger.info(f"Processing {len(answers_data)} answers for response {response.id}")
        
        created_answers = []
        for answer_data in answers_data:
            question_id = answer_data.get('question')
            try:
                question = Question.objects.get(id=question_id, survey=survey)
                if question.is_required:
                    answered_required.add(question_id)
                
                answer = Answer.objects.create(
                    response=response,
                    question=question,
                    nps_rating=answer_data.get('nps_rating'),
                    text_answer=answer_data.get('text_answer')
                )
                created_answers.append(answer.id)
                logger.info(f"Created answer {answer.id} for question {question_id}")
            except Question.DoesNotExist:
                logger.warning(f"Question {question_id} not found for survey {survey.id}")
                pass
            except Exception as e:
                logger.error(f"Error creating answer for question {question_id}: {str(e)}")
                raise
        
        logger.info(f"Successfully created {len(created_answers)} answers for response {response.id}")
        
        # Check if all required questions were answered
        missing_questions = Question.objects.filter(id__in=required_questions - answered_required)
        if missing_questions.exists():
            response.delete()  # Clean up the incomplete response
            missing_texts = [f"{q.questions.get(language, q.questions.get('en', 'Untitled Question'))}" 
                           for q in missing_questions]
            return DRFResponse(
                {'detail': f'Please answer all required questions: {", ".join(missing_texts)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return DRFResponse({
            'detail': 'Response submitted successfully',
            'response_id': response.id
        })


class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        # Get counts based on user role
        is_admin = request.user.groups.filter(name='Admin').exists()
        is_organizer = request.user.groups.filter(name='Organizer').exists()
        
        # Get survey counts
        if is_admin or is_organizer:
            # Admin and Organizer see all surveys
            total_surveys = Survey.objects.count()
            surveys = Survey.objects.all()
        else:
            # Others only see their own surveys
            total_surveys = Survey.objects.filter(created_by=request.user).count()
            surveys = Survey.objects.filter(created_by=request.user)
        
        # Get response counts for accessible surveys
        total_responses = Response.objects.filter(survey__in=surveys).count()
        
        # Calculate survey completion rate
        completion_rate = 0
        if total_surveys > 0:
            completed_surveys = 0
            for survey in surveys:
                if self.calculate_survey_completion(survey) >= 100:
                    completed_surveys += 1
            
            completion_rate = (completed_surveys / total_surveys) * 100
        
        # Recent activity - show responses for accessible surveys
        recent_responses = Response.objects.filter(
            survey__in=surveys
        ).order_by('-created_at')[:5]
        
        recent_activity = []
        for response in recent_responses:
            recent_activity.append({
                'type': 'response',
                'description': f"New response to {response.survey.title}",
                'date': response.created_at.strftime("%Y-%m-%d %H:%M")
            })
        
        # Prepare response data
        response_data = {
            'total_surveys': total_surveys,
            'total_responses': total_responses,
            'survey_completion_rate': round(completion_rate, 1),
            'recent_activity': recent_activity
        }
        
        # Only include user stats for Admin
        if is_admin:
            # Calculate user growth rate
            month_ago = timezone.now() - timedelta(days=30)
            total_users = User.objects.count()
            users_month_ago = User.objects.filter(date_joined__lt=month_ago).count()
            
            user_growth_rate = 0
            if users_month_ago > 0:
                user_growth_rate = ((total_users - users_month_ago) / users_month_ago) * 100
            
            response_data.update({
                'total_users': total_users,
                'user_growth_rate': round(user_growth_rate, 1)
            })
        
        return DRFResponse(response_data)
    
    def calculate_survey_completion(self, survey):
        """Calculate if a survey is complete based on required fields."""
        # Check if all required fields are filled in
        required_fields = [
            survey.title,
            survey.short_id,
            survey.project_description,
            survey.token
        ]
        
        # Count how many required fields are filled
        filled_fields = sum(1 for field in required_fields if field)
        
        # Check if the survey has at least one question
        has_questions = Question.objects.filter(survey=survey).exists()
        
        if not filled_fields:
            return 0
            
        # Calculate completion percentage
        completion = (filled_fields / len(required_fields)) * 100
        
        # If no questions, cap at 90%
        if not has_questions:
            completion = min(completion, 90)
            
        return completion


class SurveyAnalysisViewSet(viewsets.ViewSet):
    """
    ViewSet for advanced survey analysis features.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorOrReadOnly]
    
    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Get analysis summary for a survey."""
        try:
            print("#############################")
            survey = Survey.objects.get(pk=pk)
            # print(survey)
            self.check_object_permissions(request, survey)
            
            # Get or generate analysis summary
            summary, created = SurveyAnalysisSummary.objects.get_or_create(survey=survey)
            # print(summary)
            # print(created)

            # If summary is old or was just created, update it
            if created or (timezone.now() - summary.last_updated).seconds > 30:
                self._update_analysis_summary(summary)
            
            serializer = SurveyAnalysisSummarySerializer(summary)
            return DRFResponse(serializer.data)
            
        except Survey.DoesNotExist:
            return DRFResponse({'detail': 'Survey not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'])
    def word_cloud(self, request, pk=None):
        """Generate word cloud data for survey text responses."""
        try:
            survey = Survey.objects.get(pk=pk)
            self.check_object_permissions(request, survey)
            
            # Get language parameter (default to first available language)
            language = request.query_params.get('language')
            if not language and survey.languages:
                language = survey.languages[0]
            
            # Get responses filtered by language
            responses = Response.objects.filter(survey=survey)
            if language:
                responses = responses.filter(language=language)
            
            # Get all text answers from these responses
            text_answers = Answer.objects.filter(
                response__in=responses,
                text_answer__isnull=False
            ).exclude(text_answer='')
            
            # Process text to generate word cloud
            analyzer = TextAnalyzer(language=language)
            word_counts = Counter()
            
            for answer in text_answers:
                if answer.text_answer:
                    word_freq = analyzer.get_word_frequencies(answer.text_answer)
                    word_counts.update(word_freq)
            
            # Format data for word cloud
            word_cloud_data = [
                {'text': word, 'value': count, 'sentiment': analyzer.get_word_sentiment(word)}
                for word, count in word_counts.most_common(100)
            ]
            
            return DRFResponse(word_cloud_data)
            
        except Survey.DoesNotExist:
            return DRFResponse({'detail': 'Survey not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'])
    def analyze_responses(self, request, pk=None):
        """
        Analyze survey responses and generate insights.
        This updates word clusters and extracts words from text responses.
        """
        try:
            survey = Survey.objects.get(pk=pk)
            self.check_object_permissions(request, survey)
            
            # Start a transaction as this is a complex operation
            with transaction.atomic():
                # Clear existing extracted words if requested
                if request.data.get('reset_analysis', False):
                    ResponseWord.objects.filter(response__survey=survey).delete()
                    WordCluster.objects.filter(survey=survey).delete()
                
                # Process all responses
                self._analyze_survey_responses(survey)
                
                # Update the analysis summary
                summary, _ = SurveyAnalysisSummary.objects.get_or_create(survey=survey)
                self._update_analysis_summary(summary)
            
            return DRFResponse({'detail': 'Survey responses analyzed successfully'})
            
        except Survey.DoesNotExist:
            return DRFResponse({'detail': 'Survey not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error analyzing responses: {str(e)}")
            return DRFResponse(
                {'detail': f'Error analyzing responses: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def clusters(self, request, pk=None):
        """Get word clusters for a survey."""
        try:
            survey = Survey.objects.get(pk=pk)
            self.check_object_permissions(request, survey)
            
            # Get clusters ordered by frequency
            clusters = WordCluster.objects.filter(survey=survey).order_by('-frequency')
            
            # Filter by type if requested
            cluster_type = request.query_params.get('type')
            if cluster_type == 'positive':
                clusters = clusters.filter(is_positive=True)
            elif cluster_type == 'negative':
                clusters = clusters.filter(is_negative=True)
            elif cluster_type == 'neutral':
                clusters = clusters.filter(is_neutral=True)
            
            # Limit results
            limit = int(request.query_params.get('limit', 10))
            clusters = clusters[:limit]
            
            serializer = WordClusterSerializer(clusters, many=True)
            return DRFResponse(serializer.data)
            
        except Survey.DoesNotExist:
            return DRFResponse({'detail': 'Survey not found'}, status=status.HTTP_404_NOT_FOUND)
    
    def _analyze_survey_responses(self, survey):
        """Analyze all responses for a survey and extract insights."""
        # Get all responses for the survey
        responses = Response.objects.filter(survey=survey)
        
        print("Response length")
        print(len(responses))
        # Process each response
        for response in responses:
            self._analyze_single_response(response)
        
        # After processing all responses, identify clusters
        self._generate_word_clusters(survey)
    
    def _analyze_single_response(self, response):
        """Analyze a single response to extract words and sentiments."""
        # Skip responses that have already been processed
        if ResponseWord.objects.filter(response=response).exists():
            return
        
        # Get all text answers from this response
        text_answers = Answer.objects.filter(
            response=response,
            text_answer__isnull=False
        ).exclude(text_answer='')
        
        analyzer = TextAnalyzer(language=response.language)
        
        # Process each text answer
        for answer in text_answers:
            if not answer.text_answer:
                continue
                
            # Calculate sentiment for the answer if not already done
            if answer.sentiment_score is None:
                answer.sentiment_score = analyzer.get_sentiment_score(answer.text_answer)
                answer.save()
            
            # Extract words from the answer
            word_freq = analyzer.get_word_frequencies(answer.text_answer)
            
            # Save each word with its sentiment and frequency
            for word, frequency in word_freq.items():
                # Calculate sentiment specifically for this word in context
                word_sentiment = analyzer.get_word_sentiment(word, answer.text_answer)
                
                # Create or update the ResponseWord
                ResponseWord.objects.create(
                    response=response,
                    answer=answer,
                    word=word,
                    original_text=answer.text_answer,
                    frequency=frequency,
                    sentiment_score=word_sentiment,
                    language=response.language
                )
    
    def _generate_word_clusters(self, survey):
        """Generate word clusters from extracted words."""
        # Get all unique words from this survey
        unique_words = ResponseWord.objects.filter(
            response__survey=survey
        ).values('word').annotate(
            total_frequency=Count('id'),
            avg_sentiment=Avg('sentiment_score')
        ).order_by('-total_frequency')
        
        # Get all text answers for clustering
        text_answers = Answer.objects.filter(
            response__survey=survey,
            text_answer__isnull=False
        ).exclude(text_answer='').values_list('text_answer', flat=True)
        
        # Convert to list
        texts = list(text_answers)
        
        # Only perform clustering if we have enough data
        if len(texts) < 5:
            return
        
        # Use our clustering utility to find clusters
        clusters = cluster_responses(texts, min_samples=2, eps=0.5)
        
        # Process each cluster
        for cluster_id, indices in clusters.items():
            # Skip noise cluster (-1)
            if cluster_id == -1:
                continue
                
            # Get the texts in this cluster
            cluster_texts = [texts[i] for i in indices]
            
            # Find most common words in this cluster
            analyzer = TextAnalyzer()
            word_counter = Counter()
            
            for text in cluster_texts:
                words = analyzer.extract_words(text)
                word_counter.update(words)
            
            # Get the top words for the cluster name
            top_words = [word for word, _ in word_counter.most_common(3)]
            cluster_name = " ".join(top_words) if top_words else f"Cluster {cluster_id}"
            
            # Calculate average sentiment for the cluster
            sentiment_scores = [analyzer.get_sentiment_score(text) for text in cluster_texts]
            avg_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0
            
            # Determine cluster type based on sentiment
            is_positive = avg_sentiment > 0.2
            is_negative = avg_sentiment < -0.2
            is_neutral = not (is_positive or is_negative)
            
            # Create or update the cluster
            cluster, created = WordCluster.objects.update_or_create(
                survey=survey,
                name=cluster_name,
                defaults={
                    'description': "\n".join(cluster_texts[:5]),  # First few examples
                    'sentiment_score': avg_sentiment,
                    'frequency': len(cluster_texts),
                    'is_positive': is_positive,
                    'is_negative': is_negative,
                    'is_neutral': is_neutral
                }
            )
            
            # Associate words with this cluster
            if created:
                words_to_associate = ResponseWord.objects.filter(
                    response__survey=survey,
                    word__in=top_words
                )
                
                for word in words_to_associate:
                    word.clusters.add(cluster)
    
    def _update_analysis_summary(self, summary):
        """Update the analysis summary with the latest data."""
        survey = summary.survey
        
        # Count responses
        response_count = Response.objects.filter(survey=survey).count()
        print("Response counts in update analysis")
        print(response_count)
        summary.response_count = response_count
        
        # Get NPS ratings
        nps_scores = Answer.objects.filter(
            response__survey=survey,
            nps_rating__isnull=False
        ).values_list('nps_rating', flat=True)
        
        nps_scores_list = list(nps_scores)
        
        # Calculate statistics if we have scores
        if nps_scores_list:
            stats = calculate_stats_from_scores(nps_scores_list)
            summary.average_satisfaction = stats['average']
            summary.median_satisfaction = stats['median']
            summary.satisfaction_confidence_low = stats['conf_low']
            summary.satisfaction_confidence_high = stats['conf_high']
            
            # Calculate satisfaction score
            nps_data = calculate_satisfaction_score(nps_scores_list)
            summary.satisfaction_score = nps_data['score']
            summary.positive_percentage = nps_data['promoters_pct']
            summary.negative_percentage = nps_data['detractors_pct']
            summary.neutral_percentage = nps_data['passives_pct']
        
        # Language breakdown
        languages = Response.objects.filter(survey=survey).values('language').annotate(
            count=Count('id')
        )
        language_breakdown = {item['language']: item['count'] for item in languages}
        summary.language_breakdown = language_breakdown
        
        # Get top clusters
        top_clusters = WordCluster.objects.filter(survey=survey).order_by('-frequency')[:10]
        summary.top_clusters = list(top_clusters.values_list('id', flat=True))
        
        # Get top positive clusters
        top_positive = WordCluster.objects.filter(
            survey=survey, is_positive=True
        ).order_by('-frequency')[:10]
        summary.top_positive_clusters = list(top_positive.values_list('id', flat=True))
        
        # Get top negative clusters
        top_negative = WordCluster.objects.filter(
            survey=survey, is_negative=True
        ).order_by('-frequency')[:10]
        summary.top_negative_clusters = list(top_negative.values_list('id', flat=True))
        
        # Get top neutral clusters
        top_neutral = WordCluster.objects.filter(
            survey=survey, is_neutral=True
        ).order_by('-frequency')[:10]
        summary.top_neutral_clusters = list(top_neutral.values_list('id', flat=True))
        
        # Calculate sentiment divergence
        words = ResponseWord.objects.filter(response__survey=survey)
        if words.exists():
            weighted_sentiments = words.annotate(
                weighted=Cast(F('sentiment_score') * F('frequency'), FloatField())
            ).values_list('weighted', flat=True)
            
            weighted_sum = sum(weighted_sentiments)
            total_frequency = words.aggregate(total=Sum('frequency'))['total'] or 1
            weighted_avg = weighted_sum / total_frequency
            
            # Calculate divergence from average satisfaction
            if summary.average_satisfaction:
                # Normalize satisfaction to -1 to 1 scale (it's typically 0-10)
                norm_satisfaction = (summary.average_satisfaction / 10 * 2) - 1
                summary.sentiment_divergence = abs(weighted_avg - norm_satisfaction)
        
        summary.save()
        return summary


class CustomWordClusterViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing custom word clusters.
    These are user-defined clusters that can be used across all surveys.
    """
    queryset = CustomWordCluster.objects.all()
    serializer_class = CustomWordClusterSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter clusters to only those created by the current user or shared/global clusters."""
        user = self.request.user
        
        # Admin can see all clusters
        if user.is_staff or user.groups.filter(name="Admin").exists():
            return CustomWordCluster.objects.all()
        
        # Others can only see their own clusters
        return CustomWordCluster.objects.filter(created_by=user)
    
    def perform_create(self, serializer):
        """Save the current user as the creator of the cluster."""
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get only active custom word clusters."""
        queryset = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(queryset, many=True)
        return DRFResponse(serializer.data)
    
    @action(detail=True, methods=['post'])
    def toggle_status(self, request, pk=None):
        """Toggle the active status of a custom word cluster."""
        cluster = self.get_object()
        cluster.is_active = not cluster.is_active
        cluster.save()
        serializer = self.get_serializer(cluster)
        return DRFResponse(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_keywords(self, request, pk=None):
        """Add keywords to a custom word cluster."""
        cluster = self.get_object()
        
        keywords = request.data.get('keywords', [])
        if not isinstance(keywords, list):
            return DRFResponse(
                {'detail': 'Keywords must be provided as a list'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Add new keywords, avoiding duplicates
        current_keywords = set(cluster.keywords)
        for keyword in keywords:
            if keyword and keyword.strip():
                current_keywords.add(keyword.strip().lower())
        
        cluster.keywords = list(current_keywords)
        cluster.save()
        
        serializer = self.get_serializer(cluster)
        return DRFResponse(serializer.data)
    
    @action(detail=True, methods=['post'])
    def remove_keyword(self, request, pk=None):
        """Remove a keyword from a custom word cluster."""
        cluster = self.get_object()
        keyword = request.data.get('keyword', '')
        
        if keyword in cluster.keywords:
            cluster.keywords.remove(keyword)
            cluster.save()
        
        serializer = self.get_serializer(cluster)
        return DRFResponse(serializer.data)

