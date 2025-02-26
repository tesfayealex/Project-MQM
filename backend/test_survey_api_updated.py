#!/usr/bin/env python3
"""
Test script for myQuickMessage Survey API.

This script demonstrates how to use the Survey API endpoints
to create, read, update, and delete surveys and questions.
"""

import requests
import json
from datetime import datetime, timedelta

# API base URL
BASE_URL = "http://localhost:8000/api"

# Authentication credentials
USERNAME = "admin"
PASSWORD = "admin123"

# Step 1: Log in and get authentication token
def login():
    """Log in and get authentication cookies."""
    login_url = f"{BASE_URL}/auth/login/"
    
    response = requests.post(
        login_url, 
        json={"username": USERNAME, "password": PASSWORD}
    )
    
    if response.status_code == 200:
        print("Login successful")
        return response.cookies
    else:
        print(f"Login failed: {response.text}")
        return None

# Step 2: Create a survey with questions
def create_survey(cookies):
    """Create a survey with questions."""
    surveys_url = f"{BASE_URL}/surveys/"
    
    # Survey data following the schema format
    now = datetime.now()
    end_date = (now + timedelta(days=30)).isoformat()
    
    survey_data = {
        # Basic Info
        "title": "Climate Fresk Workshop Feedback",
        "description": "Help us improve our Climate Fresk workshops by providing your feedback",
        
        # Multilingual Content
        "headlines": {
            "en": "Climate Fresk Workshop Feedback",
            "de": "Klimafresko-Workshop-Feedback",
            "es": "Comentarios del taller de fresco climático"
        },
        "survey_texts": {
            "en": "Please share your thoughts on our workshop",
            "de": "Bitte teilen Sie Ihre Gedanken zu unserem Workshop mit",
            "es": "Por favor comparta sus pensamientos sobre nuestro taller"
        },
        
        # Project Information
        "building_name": "Community Center",
        "short_id": "CF-WS-0123",
        "project_description": "A workshop to raise awareness about climate change through collaborative learning",
        
        # Project Address
        "street_number": "123 Main St",
        "city_code": "10001",
        "city": "New York",
        "country": "USA",
        
        # Project Token
        "token": "cfworkshop123",
        
        # Project Details
        "languages": ["en", "de", "es"],
        "format": "face_to_face",
        "type": "public",
        "max_participants": 50,
        "end_date": end_date,
        
        # End Survey Information
        "end_survey_titles": {
            "en": ["Thank you for your feedback!", "Your input helps us improve our workshops"],
            "de": ["Vielen Dank für Ihr Feedback!", "Ihr Beitrag hilft uns, unsere Workshops zu verbessern"],
            "es": ["¡Gracias por tus comentarios!", "Tu aporte nos ayuda a mejorar nuestros talleres"]
        },
        "expired_survey_titles": {
            "en": "This survey has ended",
            "de": "Diese Umfrage ist beendet",
            "es": "Esta encuesta ha finalizado"
        },
        "expired_survey_texts": {
            "en": "Thank you for your interest, but this survey is no longer accepting responses",
            "de": "Vielen Dank für Ihr Interesse, aber diese Umfrage nimmt keine Antworten mehr entgegen",
            "es": "Gracias por su interés, pero esta encuesta ya no acepta respuestas"
        },
        
        # Questions
        "questions": [
            {
                "questions": {
                    "en": "How likely are you to recommend our workshop to a friend or colleague?",
                    "de": "Wie wahrscheinlich ist es, dass Sie unseren Workshop einem Freund oder Kollegen empfehlen würden?",
                    "es": "¿Qué probabilidad hay de que recomiende nuestro taller a un amigo o colega?"
                },
                "placeholders": {
                    "en": "Rate from 0 to 10",
                    "de": "Bewerten Sie von 0 bis 10",
                    "es": "Califica del 0 al 10"
                },
                "type": "nps",
                "language": "en",
                "is_required": True
            },
            {
                "questions": {
                    "en": "What aspects of the workshop did you find most valuable?",
                    "de": "Welche Aspekte des Workshops fanden Sie am wertvollsten?",
                    "es": "¿Qué aspectos del taller le parecieron más valiosos?"
                },
                "placeholders": {
                    "en": "Please provide details",
                    "de": "Bitte geben Sie Details an",
                    "es": "Por favor proporcione detalles"
                },
                "type": "free_text",
                "language": "en",
                "is_required": True
            },
            {
                "questions": {
                    "en": "How would you rate the facilitator's knowledge and presentation skills?",
                    "de": "Wie bewerten Sie das Wissen und die Präsentationsfähigkeiten des Moderators?",
                    "es": "¿Cómo calificaría el conocimiento y las habilidades de presentación del facilitador?"
                },
                "placeholders": {
                    "en": "Rate from 0 to 10",
                    "de": "Bewerten Sie von 0 bis 10",
                    "es": "Califica del 0 al 10"
                },
                "type": "nps",
                "language": "en",
                "is_required": True
            },
            {
                "questions": {
                    "en": "Do you have any suggestions for improving the workshop?",
                    "de": "Haben Sie Vorschläge zur Verbesserung des Workshops?",
                    "es": "¿Tiene alguna sugerencia para mejorar el taller?"
                },
                "placeholders": {
                    "en": "Optional feedback",
                    "de": "Optionales Feedback",
                    "es": "Comentarios opcionales"
                },
                "type": "free_text",
                "language": "en",
                "is_required": False
            }
        ]
    }
    
    response = requests.post(
        surveys_url, 
        json=survey_data,
        cookies=cookies
    )
    
    if response.status_code == 201:
        print("Survey created successfully")
        return response.json()
    else:
        print(f"Failed to create survey: {response.text}")
        return None

# Step 3: Get all surveys
def get_surveys(cookies):
    """Get all surveys."""
    surveys_url = f"{BASE_URL}/surveys/"
    response = requests.get(surveys_url, cookies=cookies)
    
    if response.status_code == 200:
        surveys = response.json()
        print(f"Retrieved {len(surveys)} surveys")
        return surveys
    else:
        print(f"Failed to get surveys: {response.text}")
        return None

# Step 4: Get a specific survey
def get_survey(survey_id, cookies):
    """Get a specific survey."""
    survey_url = f"{BASE_URL}/surveys/{survey_id}/"
    response = requests.get(survey_url, cookies=cookies)
    
    if response.status_code == 200:
        survey = response.json()
        print(f"Retrieved survey: {survey['title']}")
        return survey
    else:
        print(f"Failed to get survey: {response.text}")
        return None

# Step 5: Update a survey
def update_survey(survey_id, cookies):
    """Update a survey."""
    survey_url = f"{BASE_URL}/surveys/{survey_id}/"
    
    # Get the current survey first
    current_survey = get_survey(survey_id, cookies)
    if not current_survey:
        return None
    
    # Update some fields
    update_data = {
        "title": current_survey["title"] + " (Updated)",
        "description": current_survey["description"] + " - This survey has been updated.",
        "is_active": current_survey["is_active"]
    }
    
    response = requests.patch(survey_url, json=update_data, cookies=cookies)
    
    if response.status_code == 200:
        print("Survey updated successfully")
        return response.json()
    else:
        print(f"Failed to update survey: {response.text}")
        return None

# Step 6: Delete a survey
def delete_survey(survey_id, cookies):
    """Delete a survey."""
    survey_url = f"{BASE_URL}/surveys/{survey_id}/"
    response = requests.delete(survey_url, cookies=cookies)
    
    if response.status_code == 204:
        print("Survey deleted successfully")
        return True
    else:
        print(f"Failed to delete survey: {response.text}")
        return False

# Step 7: Submit a response to a survey
def submit_response(survey_id):
    """Submit a response to a survey (no authentication required)."""
    response_url = f"{BASE_URL}/responses/submit_response/"
    
    response_data = {
        "survey": survey_id,
        "language": "en",
        "answers": [
            {
                "question": 1,  # Replace with actual question ID
                "nps_rating": 9
            },
            {
                "question": 2,  # Replace with actual question ID
                "text_answer": "The collaborative activities were most valuable to me."
            },
            {
                "question": 3,  # Replace with actual question ID
                "nps_rating": 8
            },
            {
                "question": 4,  # Replace with actual question ID
                "text_answer": "The workshop could be improved by adding more interactive elements."
            }
        ]
    }
    
    response = requests.post(response_url, json=response_data)
    
    if response.status_code == 201:
        print("Response submitted successfully")
        return response.json()
    else:
        print(f"Failed to submit response: {response.text}")
        return None

# Step 8: Get survey statistics
def get_survey_stats(survey_id, cookies):
    """Get statistics for a survey."""
    stats_url = f"{BASE_URL}/surveys/{survey_id}/stats/"
    response = requests.get(stats_url, cookies=cookies)
    
    if response.status_code == 200:
        stats = response.json()
        print(f"Retrieved survey stats: {stats}")
        return stats
    else:
        print(f"Failed to get survey stats: {response.text}")
        return None

if __name__ == "__main__":
    # Execute all steps
    cookies = login()
    if cookies:
        # Create a survey
        survey = create_survey(cookies)
        if survey:
            survey_id = survey["id"]
            
            # Get all surveys
            surveys = get_surveys(cookies)
            
            # Get specific survey
            survey_detail = get_survey(survey_id, cookies)
            
            # Update the survey
            updated_survey = update_survey(survey_id, cookies)
            
            # Submit a response
            response = submit_response(survey_id)
            
            # Get survey statistics
            stats = get_survey_stats(survey_id, cookies)
            
            # Delete the survey (comment out if you want to keep it)
            # delete_survey(survey_id, cookies)
    
    print("Test completed!") 