from django.shortcuts import render
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.models import User, Group
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .serializers import UserSerializer, UserProfileSerializer, GroupSerializer

# Create your views here.

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_staff or request.user.groups.filter(name='Admin').exists()

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'me':
            return UserProfileSerializer
        return UserSerializer
    
    def get_queryset(self):
        # Allow admin users to see all users
        # Regular users can only see themselves
        if self.request.user.is_staff or self.request.user.groups.filter(name='Admin').exists():
            return User.objects.all().order_by('-date_joined')
        return User.objects.filter(id=self.request.user.id)

    @action(detail=False, methods=['get', 'put', 'patch'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        if request.method == 'GET':
            serializer = self.get_serializer(request.user)
            return Response(serializer.data)
        
        serializer = self.get_serializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrReadOnly])
    def set_groups(self, request, pk=None):
        user = self.get_object()
        group_ids = request.data.get('group_ids', [])
        
        groups = Group.objects.filter(id__in=group_ids)
        user.groups.set(groups)
        
        serializer = self.get_serializer(user)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrReadOnly])
    def activate(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save()
        
        serializer = self.get_serializer(user)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrReadOnly])
    def deactivate(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save()
        
        serializer = self.get_serializer(user)
        return Response(serializer.data)

class GroupViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

class AuthViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]
    
    @action(detail=False, methods=['post'])
    def login(self, request):
        if request.user.is_authenticated:
            return Response({'detail': 'Already authenticated'}, status=status.HTTP_400_BAD_REQUEST)
        
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not email or not password:
            return Response({'detail': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        print(f"Authentication attempt for user: {email}")
        
        # Try to authenticate with email as username
        user = authenticate(username=email, password=password)
        
        if not user:
            # If authentication failed, try to find user by email
            try:
                user_obj = User.objects.get(email=email)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None

        if not user:
            print(f"Authentication failed for {email}")
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check if user is active
        if not user.is_active:
            print(f"User {email} is inactive")
            return Response({'detail': 'This account has been deactivated'}, status=status.HTTP_403_FORBIDDEN)
        
        # Login the user to create a session
        login(request, user)
        
        # Set session cookie to ensure it's included in the response
        request.session.modified = True
        
        # Log the session ID for debugging
        print(f"User {email} logged in successfully")
        print(f"Session ID: {request.session.session_key}")
        print(f"Session cookie: {request.session.get_session_cookie_age()}")
        
        # Get the serialized user data 
        serializer = UserProfileSerializer(user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def logout(self, request):
        if not request.user.is_authenticated:
            return Response({'detail': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Get email for logging
        email = request.user.email
        
        # Clear the session
        logout(request)
        print(f"User {email} logged out successfully")
        
        return Response({'detail': 'Successfully logged out'})
