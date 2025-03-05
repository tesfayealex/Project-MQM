from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SurveyViewSet, QuestionViewSet, ResponseViewSet, 
    DashboardViewSet, SurveyAnalysisViewSet, CustomWordClusterViewSet
)

router = DefaultRouter()
router.register(r'surveys', SurveyViewSet)
router.register(r'questions', QuestionViewSet)
router.register(r'responses', ResponseViewSet)
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'analysis', SurveyAnalysisViewSet, basename='survey-analysis')
router.register(r'custom-clusters', CustomWordClusterViewSet, basename='custom-clusters')

urlpatterns = [
    path('', include(router.urls)),
]

