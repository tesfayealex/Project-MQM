import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')
import django
django.setup()
from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("""
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'surveys_answer' AND column_name = 'question_id';
    """)
    result = cursor.fetchall()
    print(result) 