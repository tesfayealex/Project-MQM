from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SurveyViewSet, QuestionViewSet, ResponseViewSet, 
    DashboardViewSet, SurveyAnalysisViewSet, CustomWordClusterViewSet,
    ProcessTextView, ProcessSurveyResponsesView, TemplateViewSet,
    survey_sentence_sentiment_analysis, process_answer_sentiment,
    process_survey_sentence_sentiment, check_survey_has_responses,
    debug_survey_questions, test_export_endpoint, export_survey_responses_excel,
    export_survey_clusters_excel
)

router = DefaultRouter()
router.register(r'surveys', SurveyViewSet)
router.register(r'questions', QuestionViewSet)
router.register(r'responses', ResponseViewSet)
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'analysis', SurveyAnalysisViewSet, basename='survey-analysis')
router.register(r'custom-clusters', CustomWordClusterViewSet, basename='custom-clusters')
router.register(r'templates', TemplateViewSet, basename='templates')

urlpatterns = [
    path('', include(router.urls)),
    path('process-text/', ProcessTextView.as_view(), name='process-text'),
    path('process-survey-responses/', ProcessSurveyResponsesView.as_view(), name='process-survey-responses'),
    path('surveys/<int:survey_id>/sentence-sentiment-analysis/', survey_sentence_sentiment_analysis, name='survey-sentence-sentiment-analysis'),
    path('answers/<int:answer_id>/process-sentiment/', process_answer_sentiment, name='process-answer-sentiment'),
    path('surveys/<int:survey_id>/process-sentence-sentiment/', process_survey_sentence_sentiment, name='process-survey-sentence-sentiment'),
    path('surveys/<int:survey_id>/check-has-responses/', check_survey_has_responses, name='check-survey-has-responses'),
    path('surveys/<int:survey_id>/debug-questions/', debug_survey_questions, name='debug-survey-questions'),
    path('surveys/<int:survey_id>/test-export/', test_export_endpoint, name='test-export-endpoint'),
    path('surveys/<int:survey_id>/excel-export/', export_survey_responses_excel, name='survey-excel-export'),
    path('surveys/<int:survey_id>/clusters-export/', export_survey_clusters_excel, name='survey-clusters-export'),
]

