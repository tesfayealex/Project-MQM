from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from django.db.models import Count, Avg, Q, F, Sum, FloatField, Case, When, Value, ExpressionWrapper
from django.db.models.functions import Cast
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
from .utils import (
    TextAnalyzer, cluster_responses, calculate_stats_from_scores, 
    calculate_satisfaction_score, process_text, process_survey_and_assign_clusters, assign_clusters_to_words,
    analyze_response_clusters
)
from rest_framework.views import APIView

# Configure logger
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
                Q(description__icontains=search)
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

    @action(detail=True, methods=['get'])
    def extracted_words(self, request, pk=None):
        """
        Retrieve all extracted words for a specific response.
        """
        response = self.get_object()
        from .models import ResponseWord
        
        # Get all extracted words for this response
        words = ResponseWord.objects.filter(response=response)
        
        # Create a serializable format
        result = []
        for word in words:
            # Get the custom cluster name if assigned
            assigned_cluster = word.assigned_cluster
            
            # If no directly assigned cluster, check if it belongs to any custom clusters
            if not assigned_cluster and word.custom_clusters.exists():
                assigned_cluster = word.custom_clusters.first().name
                
            result.append({
                'id': word.id,
                'word': word.word,
                'original_text': word.original_text,
                'frequency': word.frequency,
                'sentiment_score': word.sentiment_score,
                'assigned_cluster': assigned_cluster,
                'answer_id': word.answer_id
            })
            
        return DRFResponse(result)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def update_word_cluster(self, request):
        """
        Update the assigned cluster for a specific ResponseWord.
        """
        word_id = request.data.get('word_id')
        cluster_name = request.data.get('cluster_name')
        
        if not word_id or not cluster_name:
            return DRFResponse(
                {'detail': 'Both word_id and cluster_name are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            from .models import ResponseWord, CustomWordCluster
            word = ResponseWord.objects.get(id=word_id)
            
            # Update the directly assigned cluster
            word.assigned_cluster = cluster_name
            word.save()
            
            # Check if the cluster exists, if not create it
            cluster, created = CustomWordCluster.objects.get_or_create(
                name=cluster_name,
                defaults={
                    'created_by': request.user if request.user.is_authenticated else None,
                    'is_active': True
                }
            )
            
            # Associate the word with the cluster if it's not already
            if cluster not in word.custom_clusters.all():
                word.custom_clusters.add(cluster)
                
            return DRFResponse({
                'id': word.id,
                'word': word.word,
                'assigned_cluster': word.assigned_cluster,
                'detail': 'Cluster updated successfully'
            })
            
        except ResponseWord.DoesNotExist:
            return DRFResponse(
                {'detail': f'Word with id {word_id} not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return DRFResponse(
                {'detail': f'Error updating cluster: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
            survey = Survey.objects.get(pk=pk)
            self.check_object_permissions(request, survey)
            
            # Get analysis summary, create if it doesn't exist
            summary, created = SurveyAnalysisSummary.objects.get_or_create(survey=survey)
            
            # Only update if it's a brand new summary
            if created:
                # Create a basic summary with response count and language breakdown
                from django.db.models import Count
                
                # Count responses
                response_count = Response.objects.filter(survey=survey).count()
                summary.response_count = response_count
                
                # Language breakdown
                languages = Response.objects.filter(survey=survey).values('language').annotate(
                    count=Count('id')
                )
                language_breakdown = {item['language']: item['count'] for item in languages}
                summary.language_breakdown = language_breakdown
                
                # Save the basic summary
                summary.save()
                
                # Log that a new summary was created
                logger.info(f"Created new analysis summary for survey {pk}")
            
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
    
    @action(detail=True, methods=['get'])
    def cluster_cloud(self, request, pk=None):
        """Generate word cloud data for clusters in a survey."""
        try:
            from django.db.models import Count, Avg
            from .models import Survey, ResponseWord, CustomWordCluster, Answer
            
            survey = Survey.objects.get(pk=pk)
            self.check_object_permissions(request, survey)
            
            # Get all custom clusters used in this survey's response words
            custom_clusters = CustomWordCluster.objects.filter(
                words__response__survey=survey
            ).distinct()
            
            # Create a list to hold word cloud data
            cluster_cloud_data = []
            
            # For each custom cluster, collect statistics
            for cc in custom_clusters:
                # Get response words for this cluster
                response_words = ResponseWord.objects.filter(
                    custom_clusters=cc,
                    response__survey=survey
                )
                
                # Skip clusters with no words
                if not response_words.exists():
                    continue
                
                # Count distinct responses
                distinct_responses = response_words.values('response').distinct().count()
                
                # Only include clusters that appear in a significant number of responses
                if distinct_responses < 2:
                    continue
                    
                # Calculate average sentiment
                avg_sentiment = response_words.aggregate(Avg('sentiment_score'))['sentiment_score__avg'] or 0
                
                # Get NPS ratings from associated responses
                nps_answers = Answer.objects.filter(
                    response__in=response_words.values('response').distinct(),
                    nps_rating__isnull=False
                )
                
                # Determine cluster category
                is_positive = False
                is_negative = False
                is_neutral = True
                
                if nps_answers.exists():
                    nps_scores = list(nps_answers.values_list('nps_rating', flat=True))
                    avg_nps = sum(nps_scores) / len(nps_scores) if nps_scores else None
                    
                    if avg_nps is not None:
                        if avg_nps >= 9:
                            is_positive = True
                            is_neutral = False
                        elif avg_nps <= 6:
                            is_negative = True
                            is_neutral = False
                elif avg_sentiment > 0.3:
                    is_positive = True
                    is_neutral = False
                elif avg_sentiment < -0.3:
                    is_negative = True
                    is_neutral = False
                
                # Add to word cloud data
                cluster_cloud_data.append({
                    'text': cc.name,
                    'value': distinct_responses,
                    'sentiment': avg_sentiment,
                    'is_positive': is_positive,
                    'is_negative': is_negative,
                    'is_neutral': is_neutral
                })
            
            # Sort by frequency (value)
            cluster_cloud_data.sort(key=lambda x: x['value'], reverse=True)
            
            # Limit to top 50 clusters
            cluster_cloud_data = cluster_cloud_data[:50]
            
            return DRFResponse(cluster_cloud_data)
            
        except Survey.DoesNotExist:
            return DRFResponse({'detail': 'Survey not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error generating cluster cloud: {str(e)}", exc_info=True)
            return DRFResponse(
                {"error": f"Error generating cluster cloud: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def analyze_responses(self, request, pk=None):
        """
        Analyze survey responses - this only updates the analysis summary without processing text
        or creating new clusters. Use process_all_responses for full processing.
        """
        try:
            from .models import Survey, SurveyAnalysisSummary, ResponseWord, CustomWordCluster, Answer
            from django.db.models import Count, Avg, F, Q
            from django.db import transaction
            import logging
            
            logger = logging.getLogger(__name__)
            
            survey = Survey.objects.get(pk=pk)
            self.check_object_permissions(request, survey)
            
            # Use transaction to ensure all changes are saved together
            with transaction.atomic():
                # Get or create an analysis summary object
                summary, created = SurveyAnalysisSummary.objects.get_or_create(survey=survey)
                
                # Count responses and update basic stats
                response_count = survey.responses.count()
                summary.response_count = response_count
                
                # Calculate language breakdown
                language_breakdown = dict(survey.responses.values('language').annotate(count=Count('id')).values_list('language', 'count'))
                summary.language_breakdown = language_breakdown
                
                # Calculate NPS/satisfaction stats from existing data
                nps_answers = Answer.objects.filter(response__survey=survey, nps_rating__isnull=False)
                if nps_answers.exists():
                    # Basic stats
                    nps_ratings = list(nps_answers.values_list('nps_rating', flat=True))
                    avg_satisfaction = sum(nps_ratings) / len(nps_ratings) if nps_ratings else 0
                    
                    # Other stats calculations would go here
                    # (for brevity, we're simplifying this part)
                    summary.average_satisfaction = avg_satisfaction
                    summary.median_satisfaction = avg_satisfaction  # Simplified
                    summary.satisfaction_confidence_low = avg_satisfaction - 1  # Simplified
                    summary.satisfaction_confidence_high = avg_satisfaction + 1  # Simplified
                    
                    # Calculate NPS score (% promoters - % detractors)
                    promoters = sum(1 for score in nps_ratings if score >= 9)
                    detractors = sum(1 for score in nps_ratings if score <= 6)
                    
                    promoter_pct = (promoters / len(nps_ratings)) * 100 if nps_ratings else 0
                    detractor_pct = (detractors / len(nps_ratings)) * 100 if nps_ratings else 0
                    
                    summary.satisfaction_score = promoter_pct - detractor_pct
                    summary.positive_percentage = promoter_pct
                    summary.negative_percentage = detractor_pct
                    summary.neutral_percentage = 100 - promoter_pct - detractor_pct
                
                # Get top clusters from current data (no new processing)
                response_words = ResponseWord.objects.filter(response__survey=survey)
                
                # Get clusters with counts and average sentiment
                custom_clusters = CustomWordCluster.objects.filter(
                    words__in=response_words
                ).annotate(
                    response_count=Count('words__response', distinct=True),
                    avg_sentiment=Avg('words__sentiment_score')
                ).order_by('-response_count')
                
                # Update summary with cluster IDs
                if custom_clusters.exists():
                    # Get top overall clusters
                    summary.top_clusters = list(custom_clusters.values_list('id', flat=True)[:10])
                    
                    # Create a list to store categorized clusters
                    positive_clusters = []
                    negative_clusters = []
                    neutral_clusters = []
                    
                    # Process each cluster to determine its category
                    for cluster in custom_clusters:
                        # Get NPS ratings from responses associated with this cluster
                        response_ids = ResponseWord.objects.filter(
                            custom_clusters=cluster,
                            response__survey=survey
                        ).values_list('response', flat=True).distinct()
                        
                        # Get NPS ratings for these responses
                        nps_answers = Answer.objects.filter(
                            response__in=response_ids,
                            nps_rating__isnull=False
                        )
                        
                        # Calculate average NPS if available
                        avg_nps = None
                        if nps_answers.exists():
                            nps_ratings = list(nps_answers.values_list('nps_rating', flat=True))
                            avg_nps = sum(nps_ratings) / len(nps_ratings) if nps_ratings else None
                        
                        # Determine cluster category using the same logic as direct_process_all_responses
                        if avg_nps is not None:
                            if avg_nps >= 9:
                                positive_clusters.append(cluster.id)
                            elif avg_nps <= 6:
                                negative_clusters.append(cluster.id)
                            else:
                                neutral_clusters.append(cluster.id)
                        elif cluster.avg_sentiment > 0.3:
                            positive_clusters.append(cluster.id)
                        elif cluster.avg_sentiment < -0.3:
                            negative_clusters.append(cluster.id)
                        else:
                            neutral_clusters.append(cluster.id)
                    
                    # Update summary with cluster IDs by category
                    summary.top_positive_clusters = positive_clusters[:5]
                    summary.top_negative_clusters = negative_clusters[:5]
                    summary.top_neutral_clusters = neutral_clusters[:5]
                
                # Explicitly save the changes
                summary.save()
                
                # Verify the save was successful by retrieving it again
                refreshed_summary = SurveyAnalysisSummary.objects.get(id=summary.id)
                
                # Log what was updated
                logger.info(f"Updated analysis summary for survey {pk}. Response count: {refreshed_summary.response_count}")
                logger.info(f"Top clusters: {refreshed_summary.top_clusters}")
            
            return DRFResponse({
                'detail': 'Survey analysis summary updated successfully',
                'summary_id': summary.id,
                'top_clusters': summary.top_clusters,
                'response_count': summary.response_count,
                'last_updated': summary.last_updated.isoformat() if summary.last_updated else None
            })
            
        except Survey.DoesNotExist:
            return DRFResponse({'detail': 'Survey not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error analyzing responses: {str(e)}", exc_info=True)
            return DRFResponse(
                {'detail': f'Error analyzing responses: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def clusters(self, request, pk=None):
        """
        Get clusters for a survey, optionally filtered by type (positive, negative, neutral).
        If no WordCluster objects exist, falls back to using CustomWordClusters directly.
        """
        try:
            from django.db.models import Count, Avg, Q
            from .models import Survey, ResponseWord, CustomWordCluster, WordCluster, Answer
            from .serializers import WordClusterSerializer
            
            survey = Survey.objects.get(pk=pk)
            self.check_object_permissions(request, survey)
            
            # First check if we have WordCluster objects
            clusters = WordCluster.objects.filter(survey=survey)
            
            # If we don't have any WordClusters, use CustomWordClusters instead
            if not clusters.exists():
                # Get all custom clusters used in this survey's response words
                custom_clusters = CustomWordCluster.objects.filter(
                    words__response__survey=survey
                ).distinct()
                
                # Create a list to hold cluster data
                cluster_data_list = []
                
                # For each custom cluster, collect statistics
                for cc in custom_clusters:
                    # Get response words for this cluster
                    response_words = ResponseWord.objects.filter(
                        custom_clusters=cc,
                        response__survey=survey
                    )
                    
                    # Skip clusters with no words
                    if not response_words.exists():
                        continue
                    
                    # Count distinct responses
                    distinct_responses = response_words.values('response').distinct().count()
                    
                    # Calculate average sentiment
                    avg_sentiment = response_words.aggregate(Avg('sentiment_score'))['sentiment_score__avg'] or 0
                    
                    # Get NPS ratings from associated responses
                    nps_answers = Answer.objects.filter(
                        response__in=response_words.values('response').distinct(),
                        nps_rating__isnull=False
                    )
                    
                    # Calculate average NPS and determine category
                    avg_nps = None
                    is_positive = False
                    is_negative = False
                    is_neutral = True
                    
                    if nps_answers.exists():
                        nps_scores = list(nps_answers.values_list('nps_rating', flat=True))
                        avg_nps = sum(nps_scores) / len(nps_scores) if nps_scores else None
                        
                        # Use the same categorization logic as direct_process_all_responses
                        if avg_nps is not None:
                            if avg_nps >= 9:
                                is_positive = True
                                is_neutral = False
                            elif avg_nps <= 6:
                                is_negative = True
                                is_neutral = False
                    elif avg_sentiment > 0.3:
                        is_positive = True
                        is_neutral = False
                    elif avg_sentiment < -0.3:
                        is_negative = True
                        is_neutral = False
                    
                    # Create cluster data object
                    cluster_data = {
                        'id': cc.id,
                        'name': cc.name,
                        'survey': survey.id,
                        'description': cc.description or '',
                        'frequency': distinct_responses,
                        'sentiment_score': avg_sentiment,
                        'nps_score': avg_nps,
                        'is_positive': is_positive,
                        'is_negative': is_negative,
                        'is_neutral': is_neutral,
                        'custom_cluster_id': cc.id,
                        'created_at': cc.created_at.isoformat() if cc.created_at else None,
                        'updated_at': cc.updated_at.isoformat() if cc.updated_at else None
                    }
                    
                    cluster_data_list.append(cluster_data)
                
                # Filter by type if requested - ensure strict filtering by boolean values
                cluster_type = request.query_params.get('type')
                if cluster_type == 'positive':
                    cluster_data_list = [c for c in cluster_data_list if c['is_positive'] == True]
                elif cluster_type == 'negative':
                    cluster_data_list = [c for c in cluster_data_list if c['is_negative'] == True]
                elif cluster_type == 'neutral':
                    cluster_data_list = [c for c in cluster_data_list if c['is_neutral'] == True]
                
                # Sort by frequency
                cluster_data_list.sort(key=lambda x: x['frequency'], reverse=True)
                
                # Limit results
                limit = int(request.query_params.get('limit', 10))
                cluster_data_list = cluster_data_list[:limit]
                
                return DRFResponse(cluster_data_list)
            
            # If we have WordCluster objects, use the original implementation but with strict filtering
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
            clusters = clusters.order_by('-frequency')[:limit]
            
            serializer = WordClusterSerializer(clusters, many=True)
            return DRFResponse(serializer.data)
            
        except Survey.DoesNotExist:
            return DRFResponse({'detail': 'Survey not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error getting clusters: {str(e)}", exc_info=True)
            return DRFResponse(
                {"error": f"Error getting clusters: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
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

    @action(detail=True, methods=['post'])
    def direct_process_all_responses(self, request, pk=None):
        """
        Process all responses for a survey and generate analysis directly from ResponseWord and CustomCluster models
        without using the WordCluster model as an intermediary.
        
        This method identifies unprocessed responses or responses without clusters and processes them,
        then updates the analysis summary.
        """
        try:
            from django.db.models import Count, Avg, F, Q, Case, When, Value, IntegerField, Sum, FloatField, ExpressionWrapper
            from django.db.models.functions import Cast
            from django.db import transaction
            from .models import Survey, Response, Answer, ResponseWord, CustomWordCluster, SurveyAnalysisSummary
            from .utils import process_survey_and_assign_clusters, calculate_stats_from_scores, calculate_satisfaction_score
            
            survey = Survey.objects.get(pk=pk)
            self.check_object_permissions(request, survey)
            
            with transaction.atomic():
                # Get or create an analysis summary object
                summary, created = SurveyAnalysisSummary.objects.get_or_create(survey=survey)
                
                # Get all responses for this survey
                responses = Response.objects.filter(survey=survey)
                
                # Find responses that need processing:
                # 1. Responses with answers that haven't been processed
                # 2. Responses with no extracted words
                # 3. Responses with words that don't have custom clusters assigned
                
                responses_needing_text_processing = Response.objects.filter(
                    survey=survey
                ).filter(
                    Q(answers__processed=False) | 
                    ~Q(id__in=ResponseWord.objects.filter(response__survey=survey).values('response'))
                ).distinct()
                
                responses_needing_cluster_assignment = Response.objects.filter(
                    survey=survey, 
                    extracted_words__isnull=False,
                    extracted_words__custom_clusters__isnull=True
                ).distinct()
                
                # Track metrics for response
                processed_count = 0
                cluster_count = 0
                
                # Process each identified response
                for response in responses_needing_text_processing:
                    # Make sure each answer with text is marked as processed
                    for answer in response.answers.filter(text_answer__isnull=False):
                        if not answer.processed:
                            answer.process_text_answer()
                    processed_count += 1
                
                # Assign clusters where needed
                for response in responses_needing_cluster_assignment:
                    process_survey_and_assign_clusters(response.id)
                    processed_count += 1
                
                # Now directly analyze the data from ResponseWord model
                # Get all words with their custom clusters
                words_with_clusters = ResponseWord.objects.filter(
                    response__survey=survey,
                    custom_clusters__isnull=False
                ).select_related('answer', 'response')
                
                # Create a dictionary to hold our analysis results
                analysis_results = {}
                
                # Track which clusters have been seen for each response
                response_cluster_map = {}
                
                # Process each word to build cluster statistics
                for word in words_with_clusters:
                    response_id = word.response_id
                    
                    # Get NPS rating for this response (if available)
                    nps_rating = None
                    for answer in word.response.answers.all():
                        if answer.nps_rating is not None:
                            nps_rating = answer.nps_rating
                            break
                    
                    # Process each custom cluster for this word
                    for cluster in word.custom_clusters.all():
                        cluster_id = cluster.id
                        cluster_name = cluster.name
                        
                        # Initialize cluster in results if not already there
                        if cluster_id not in analysis_results:
                            analysis_results[cluster_id] = {
                                'name': cluster_name,
                                'sentiment_scores': [],
                                'nps_scores': [],
                                'frequency': 0,
                                'response_frequencies': 0,
                                'responses': set(),
                            }
                        
                        # Add sentiment score for this word
                        analysis_results[cluster_id]['sentiment_scores'].append(word.sentiment_score)
                        
                        # Update response tracking
                        if response_id not in analysis_results[cluster_id]['responses']:
                            analysis_results[cluster_id]['responses'].add(response_id)
                            analysis_results[cluster_id]['response_frequencies'] += 1
                            
                            # Also track clusters by response to avoid double-counting
                            if response_id not in response_cluster_map:
                                response_cluster_map[response_id] = set()
                            
                            response_cluster_map[response_id].add(cluster_id)
                        
                        # Add NPS rating (if available)
                        if nps_rating is not None:
                            analysis_results[cluster_id]['nps_scores'].append(nps_rating)
                
                # Compute average statistics for each cluster
                cluster_data = []
                for cluster_id, data in analysis_results.items():
                    # Compute averages
                    avg_sentiment = sum(data['sentiment_scores']) / len(data['sentiment_scores']) if data['sentiment_scores'] else 0
                    avg_nps = sum(data['nps_scores']) / len(data['nps_scores']) if data['nps_scores'] else None
                    
                    # Determine cluster category (positive, negative, neutral)
                    is_positive = False
                    is_negative = False
                    is_neutral = True
                    
                    if avg_nps is not None:
                        if avg_nps >= 9:
                            is_positive = True
                            is_neutral = False
                        elif avg_nps <= 6:
                            is_negative = True
                            is_neutral = False
                    elif avg_sentiment > 0.3:
                        is_positive = True
                        is_neutral = False
                    elif avg_sentiment < -0.3:
                        is_negative = True
                        is_neutral = False
                    
                    # Append to cluster data
                    cluster_data.append({
                        'id': cluster_id,
                        'name': data['name'],
                        'avg_sentiment': avg_sentiment,
                        'avg_nps': avg_nps,
                        'frequency': data['response_frequencies'],
                        'is_positive': is_positive,
                        'is_negative': is_negative,
                        'is_neutral': is_neutral
                    })
                
                # print(cluster_data)
                # Sort by frequency
                cluster_data = sorted(cluster_data, key=lambda x: x['frequency'], reverse=True)
                
                # Update summary object with clusters
                if cluster_data:
                    # Top clusters overall
                    summary.top_clusters = [c['id'] for c in cluster_data[:10]]
                    
                    # Top clusters by category
                    positive_clusters = [c for c in cluster_data if c['is_positive']]
                    negative_clusters = [c for c in cluster_data if c['is_negative']]
                    neutral_clusters = [c for c in cluster_data if c['is_neutral']]
                    
                    summary.top_positive_clusters = [c['id'] for c in positive_clusters[:5]]
                    summary.top_negative_clusters = [c['id'] for c in negative_clusters[:5]]
                    summary.top_neutral_clusters = [c['id'] for c in neutral_clusters[:5]]
                    
                    cluster_count = len(cluster_data)
                
                # Update other summary fields
                # Language breakdown
                languages = Response.objects.filter(survey=survey).values('language').annotate(
                    count=Count('id')
                )
                language_breakdown = {item['language']: item['count'] for item in languages}
                summary.language_breakdown = language_breakdown
                
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
                    
                    # Count responses
                    summary.response_count = Response.objects.filter(survey=survey).count()
                
                # Explicitly save the updated summary and flush to database
                summary.save()
                
                # Log what was updated
                logger.info(f"Updated analysis summary for survey {pk}. Response count: {summary.response_count}")
                logger.info(f"Top clusters: {summary.top_clusters}")
            
            # Return information about what was done
            return DRFResponse({
                'success': True,
                'message': f'Processed {processed_count} responses with {cluster_count} custom clusters',
                'processed_count': processed_count,
                'cluster_count': cluster_count,
                'clusters': cluster_data[:3] if cluster_data else [],
                'summary_id': summary.id,
                'last_updated': summary.last_updated.isoformat() if summary.last_updated else None
            })
            
        except Survey.DoesNotExist:
            return DRFResponse({"error": "Survey not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error processing responses: {str(e)}", exc_info=True)
            return DRFResponse(
                {"error": f"Error processing responses: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def process_all_responses(self, request, pk=None):
        """
        Legacy method that processes all responses and identifies ones that need text extraction
        and cluster assignment. It then updates the analysis summary.
        """
        return self.direct_process_all_responses(request, pk)


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


class ProcessTextView(APIView):
    """
    API endpoint for testing text processing.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, format=None):
        text = request.data.get('text', '')
        language = request.data.get('language', 'en')
        
        if not text:
            return DRFResponse(
                {"error": "Text is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Process the text using our utility function
        processed_words = process_text(text, language)
        
        # Assign clusters to words without saving to database
        word_clusters = assign_clusters_to_words(text, processed_words, language)
        
        # Prepare structured result with word and assigned cluster
        structured_words = []
        for word in processed_words:
            structured_words.append({
                'word': word,
                'assigned_cluster': word_clusters.get(word, 'Other')
            })
        
        # Return the processed words with cluster assignments
        return DRFResponse({
            'original_text': text,
            'language': language,
            'processed_words': processed_words,
            'structured_words': structured_words,
            'word_count': len(processed_words)
        }, status=status.HTTP_200_OK)


class ProcessSurveyResponsesView(APIView):
    """
    API endpoint for processing all responses for a survey and assigning clusters to words.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, format=None):
        survey_id = request.data.get('survey_id')
        response_id = request.data.get('response_id')
        
        if not survey_id and not response_id:
            return DRFResponse(
                {"error": "Either survey_id or response_id is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            if response_id:
                # Process a single response
                process_survey_and_assign_clusters(response_id)
                return DRFResponse({
                    'message': f'Successfully processed response {response_id}'
                }, status=status.HTTP_200_OK)
            else:
                # Process all responses for a survey
                from .models import Response, Survey
                
                try:
                    survey = Survey.objects.get(id=survey_id)
                except Survey.DoesNotExist:
                    return DRFResponse(
                        {"error": f"Survey with ID {survey_id} does not exist"}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
                
                # Get all responses for this survey
                responses = Response.objects.filter(
                    answers__question__survey=survey
                ).distinct()
                
                # Process each response
                processed_count = 0
                for response in responses:
                    try:
                        process_survey_and_assign_clusters(response.id)
                        processed_count += 1
                    except Exception as e:
                        logger.error(f"Error processing response {response.id}: {str(e)}")
                
                return DRFResponse({
                    'message': f'Successfully processed {processed_count} responses for survey {survey_id}'
                }, status=status.HTTP_200_OK)

                
        except Exception as e:
            return DRFResponse(
                {"error": f"An error occurred: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


