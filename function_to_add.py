from openai import OpenAI
from google.colab import userdata
import os

os.environ["OPENAI_API_KEY"] = userdata.get('OPENAI_API_KEY')

client = OpenAI()  # Initialize the OpenAI client

def process_survey_data(survey_name, survey_question, survey_answer, list_of_words):
    """
    Processes survey data using the OpenAI API.

    Args:
        survey_name (str): The name of the survey.
        survey_question (str): The survey question.
        survey_answer (str): The answer to the survey question.
        list_of_words (list): A list of words.

    Returns:
        str: The response from the OpenAI API.
    """

    # get cluster list from cluster model
    cluster = ["Reception", "Customer & Client", "Location & Arrival", "Air", "Furniture", "Staff", "Technical Equipment", "Temperature", "Event", "Speech & Presentation"]


    with open('survey_extract_prompt.txt', 'r') as file:
        system_prompt = file.read()

    user_message = f"Survey Name: {survey_name}\n" \
                   f"Survey Question: {survey_question}\n" \
                   f"Survey Answer: {survey_answer}\n" \
                   f"List of Words: {list_of_words}"

    completion = client.chat.completions.create(
        model="gpt-4o",  # Or another suitable model
        messages=[
            {"role": "system", "content": system_prompt.replace("change_cluster", str(cluster))},
            {"role": "user", "content": user_message}
        ],
        response_format={ "type": "json_object" }
    )

    return completion.choices[0].message.content  # Extract the response content

# Example usage:
survey_name = "Employee Satisfaction Survey"
survey_question = "What are your suggestions for improvement?"
survey_answer = "Better communication and more team-building activities."
list_of_words = ["communication", "teamwork", "collaboration"]

result = process_survey_data(survey_name, survey_question, survey_answer, list_of_words)

print(result)  # Output: (The response from the OpenAI API)