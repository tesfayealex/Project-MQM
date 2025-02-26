from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import AuthViewSet, UserViewSet, GroupViewSet

router = DefaultRouter()
router.register(r'groups', GroupViewSet, basename='group')

urlpatterns = [
    path('login/', AuthViewSet.as_view({'post': 'login'})),
    path('logout/', AuthViewSet.as_view({'post': 'logout'})),
] + router.urls 