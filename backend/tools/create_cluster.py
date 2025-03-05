import os
import sys
import django
import random

# Add the parent directory to path so we can import Django modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mqm.settings')
django.setup()

# Now we can import Django models
from django.contrib.auth.models import User
from surveys.models import CustomWordCluster, Answer, Response, Question, Survey
from surveys.utils import process_text

def create_test_cluster():
    """Create a test word cluster with some keywords."""
    # Get the first admin user
    admin = User.objects.filter(is_staff=True).first()
    
    if not admin:
        print("No admin users found. Create one with python manage.py createsuperuser")
        return
    
    # Example cluster names and keywords
    test_clusters = [
        {
            'name': 'Office Environment',
            'keywords': ['desk', 'office', 'chair', 'computer', 'monitor', 'workspace']
        },
        {
            'name': 'Technology',
            'keywords': ['software', 'hardware', 'computer', 'laptop', 'system', 'application']
        },
        {
            'name': 'Communication',
            'keywords': ['email', 'message', 'meeting', 'call', 'conversation', 'discussion']
        }
    ]
    
    created_clusters = []
    
    for cluster_data in test_clusters:
        # Create or get the cluster
        cluster, created = CustomWordCluster.objects.get_or_create(
            name=cluster_data['name'],
            defaults={
                'keywords': cluster_data['keywords'],
                'created_by': admin,
                'is_active': True
            }
        )
        
        if created:
            print(f"Created cluster: {cluster.name}")
        else:
            # Update keywords if cluster already exists
            cluster.keywords = cluster_data['keywords']
            cluster.save()
            print(f"Updated cluster: {cluster.name}")
            
        created_clusters.append(cluster)
    
    return created_clusters

def test_process_text():
    """Test processing text with different languages."""
    test_texts = {
        'en': "The modern office environment features standing desks and ergonomic chairs. Employees communicate via email and virtual meetings using software applications on their laptops.",
        'de': "Die moderne Büroumgebung bietet Stehpulte und ergonomische Stühle. Mitarbeiter kommunizieren per E-Mail und virtuelle Meetings mit Software-Anwendungen auf ihren Laptops.",
        'es': "El entorno de oficina moderna presenta escritorios de pie y sillas ergonómicas. Los empleados se comunican por correo electrónico y reuniones virtuales utilizando aplicaciones de software en sus computadoras portátiles.",
        'fr': "L'environnement de bureau moderne comprend des bureaux debout et des chaises ergonomiques. Les employés communiquent par e-mail et réunions virtuelles à l'aide d'applications logicielles sur leurs ordinateurs portables."
    }
    
    for lang, text in test_texts.items():
        print(f"\nProcessing {lang} text:")
        print(f"Original: {text}")
        
        processed_words = process_text(text, lang)
        print(f"Processed words ({len(processed_words)}):")
        print(", ".join(processed_words))

def create_test_answers():
    """Create some test answers to demonstrate the word extraction."""
    # Get all clusters
    clusters = CustomWordCluster.objects.all()
    
    if not clusters.exists():
        print("No clusters found. Create some first.")
        return
    
    # Get or create a test survey
    admin = User.objects.filter(is_staff=True).first()
    survey, created = Survey.objects.get_or_create(
        title="Test Survey",
        defaults={
            'created_by': admin
        }
    )
    
    # Add a free text question if needed
    question, created = Question.objects.get_or_create(
        survey=survey,
        type='free_text',
        defaults={
            'questions': {'en': 'What do you think about your office environment?'},
            'order': 1,
            'is_required': True
        }
    )
    
    # Create 5 test responses
    for i in range(5):
        # Create a response
        response = Response.objects.create(
            survey=survey,
            session_id=f"test-session-{random.randint(1000, 9999)}",
            language='en'
        )
        
        # Sample answers
        test_answers = [
            "I love my standing desk and ergonomic chair. The computer setup is great.",
            "The office environment is nice, but the computers are a bit outdated.",
            "Communication is difficult because we use too many different applications and software.",
            "I appreciate the modern workspace with adjustable desks.",
            "The hardware needs upgrading, but overall the technology is adequate."
        ]
        
        # Create an answer for this response
        answer = Answer.objects.create(
            response=response,
            question=question,
            text_answer=test_answers[i % len(test_answers)]
        )
        
        # Process will be handled by the signal
        
    print(f"Created {Response.objects.filter(survey=survey).count()} test responses")

if __name__ == "__main__":
    print("Creating test clusters...")
    clusters = create_test_cluster()
    
    print("\nTesting text processing...")
    test_process_text()
    
    print("\nCreating test answers...")
    create_test_answers()
    
    print("\nDone!") 