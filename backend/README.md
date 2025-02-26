# myQuickMessage (mQM) Backend

This readme contains instructions for implementing the CRUD functionality for surveys in the backend based on the schema requirements.

## Model Changes

We've updated the Survey and Question models to match the schema requirements:

1. **Survey Model:**
   - Added Project Information fields (building_name, short_id, project_description)
   - Added Project Address fields (street_number, city_code, city, country)
   - Added Project Token field (token with validation for lowercase letters only)
   - Added Project Details fields (max_participants, end_date, analysis_end_date, analysis_cluster)
   - Added End Survey Information fields (end_survey_titles, expired_survey_title, expired_survey_text)

2. **Question Model:**
   - Updated to use headline, survey_text, question, and question_placeholder fields
   - Maintained the question types (nps, free_text)

## Serializer Changes

We've updated the serializers to handle the new model fields:

1. **QuestionSerializer:** 
   - Updated to include all new fields (headline, survey_text, question, question_placeholder)

2. **SurveySerializer:**
   - Updated to include all new fields from the Survey model
   - Added token validation to ensure it contains only lowercase letters, no special characters, no spaces

3. **SurveyDetailSerializer:**
   - Created a new serializer for detailed survey operations
   - Includes nested questions data for create/update operations
   - Handles creating and updating related questions

## ViewSet Changes

We've enhanced the ViewSets to provide full CRUD functionality:

1. **SurveyViewSet:**
   - Added filtering by creator, active status, and search capability
   - Enhanced stats action to calculate NPS scores and completion rates
   - Improved completion rate calculation to consider required questions

2. **QuestionViewSet:**
   - Added proper filtering and ordering
   - Enhanced permission checks to ensure only survey creators can add questions

3. **ResponseViewSet:**
   - Added validation for active surveys, max participants, and end dates
   - Improved answer handling based on question types
   - Added required question validation
   - Enhanced session ID generation and management

4. **DashboardViewSet:**
   - Updated to provide user-specific statistics
   - Added survey completion calculation
   - Enhanced recent activity tracking

## API Endpoints

The following API endpoints are available for survey operations:

- `GET /api/surveys/` - List all surveys (filterable)
- `POST /api/surveys/` - Create a new survey with questions
- `GET /api/surveys/{id}/` - Retrieve a specific survey with its questions
- `PUT /api/surveys/{id}/` - Update a survey with its questions
- `DELETE /api/surveys/{id}/` - Delete a survey
- `GET /api/surveys/{id}/stats/` - Get statistics for a specific survey

- `GET /api/questions/` - List all questions (filterable by survey)
- `POST /api/questions/` - Create a new question
- `GET /api/questions/{id}/` - Retrieve a specific question
- `PUT /api/questions/{id}/` - Update a question
- `DELETE /api/questions/{id}/` - Delete a question

- `POST /api/responses/submit_response/` - Submit a response to a survey

- `GET /api/dashboard/stats/` - Get dashboard statistics

## Implementation Steps

To implement these changes:

1. Update models.py with the new Survey and Question models
2. Update serializers.py with the enhanced serializers
3. Update views.py with the improved ViewSets
4. Create a migration to update the database schema:
   ```
   python manage.py makemigrations surveys
   python manage.py migrate
   ```

5. Test the API endpoints to ensure they work as expected

## Notes about JSONField Usage

We've used JSONField for the `end_survey_titles` field. In Django 5.1, this requires a PostgreSQL database or SQLite 3.9+.

## Permission Structure

The permission structure is as follows:
- Anonymous users can submit survey responses
- Authenticated users can create surveys and view their own surveys
- Survey creators can edit and delete their own surveys
- Admins have full access to all surveys and responses

## Error Handling

The API includes comprehensive error handling:
- Validation errors for required fields
- Permission errors for unauthorized actions
- Proper error responses for survey state issues (inactive, ended, or full surveys)
- Validation of required questions in survey responses 