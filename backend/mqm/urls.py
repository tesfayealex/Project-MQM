from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from users.views import UserViewSet, AuthViewSet

router = DefaultRouter()
router.register(r'auth/users', UserViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/auth/', include('users.urls')),
    path('api/auth/user/', UserViewSet.as_view({'get': 'me'})),
    path('api/surveys/', include('surveys.urls')),
]

