from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from django.db.models import Count, Avg, Q
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import User
from .models import Survey, Question, Response, Answer
from .serializers import (
    SurveySerializer, 
    SurveyDetailSerializer,
    QuestionSerializer, 
    ResponseSerializer, 
    AnswerSerializer
)


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
        if self.action in ['create', 'update', 'partial_update', 'retrieve']:
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
    def submit_response(self, request):
        survey_id = request.data.get('survey')
        language = request.data.get('language', 'en')
        answers_data = request.data.get('answers', [])
        
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
        
        # Check if survey has ended
        if survey.end_date and survey.end_date < timezone.now():
            return DRFResponse({'detail': 'This survey has ended'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate a session ID if not provided
        session_id = request.data.get('session_id')
        if not session_id:
            import uuid
            session_id = str(uuid.uuid4())
        
        response = Response.objects.create(survey=survey, session_id=session_id)
        
        # Process the answers
        required_questions = set(Question.objects.filter(survey=survey, is_required=True).values_list('id', flat=True))
        answered_required = set()
        
        for answer_data in answers_data:
            question_id = answer_data.get('question')
            
            try:
                question = Question.objects.get(id=question_id, survey=survey)
            except Question.DoesNotExist:
                continue
                
            # Track answered required questions
            if question.is_required:
                answered_required.add(question.id)
                
            # Validate the answer based on question type
            if question.type == 'nps':
                nps_rating = answer_data.get('nps_rating')
                if nps_rating is None:
                    continue
                
                # Ensure NPS rating is between 0 and 10
                nps_rating = max(0, min(10, int(nps_rating)))
                
                Answer.objects.create(
                    response=response,
                    question=question,
                    nps_rating=nps_rating
                )
                
            elif question.type == 'free_text':
                text_answer = answer_data.get('text_answer')
                if not text_answer:
                    continue
                    
                Answer.objects.create(
                    response=response,
                    question=question,
                    text_answer=text_answer
                )
        
        # Check if all required questions were answered
        missing_required = required_questions - answered_required
        
        if missing_required:
            # Delete the response if required questions are missing
            response.delete()
            missing_questions = Question.objects.filter(id__in=missing_required)
            missing_texts = [f"{q.question}" for q in missing_questions]
            
            return DRFResponse({
                'detail': 'Required questions missing answers',
                'missing_questions': list(missing_required),
                'missing_texts': missing_texts
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return DRFResponse({
            'detail': 'Response submitted successfully',
            'response_id': response.id,
            'session_id': session_id
        }, status=status.HTTP_201_CREATED)


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

