import re
import math
import nltk
import string
import statistics
from collections import Counter
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import WordNetLemmatizer
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import DBSCAN
import numpy as np
from nltk.stem.snowball import SnowballStemmer
import spacy
from django.conf import settings
import os
import logging
import json
from openai import OpenAI

logger = logging.getLogger(__name__)

# Language code mapping to NLTK language names
LANGUAGE_MAPPING = {
    'en': 'english',
    'de': 'german',
    'es': 'spanish',
    'fr': 'french',
    'pt': 'portuguese'
}

# Download necessary NLTK datasets if they don't exist
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('corpus/stopwords')
except LookupError:
    nltk.download('stopwords')

try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('wordnet')

try:
    nltk.data.find('sentiment/vader_lexicon')
except LookupError:
    nltk.download('vader_lexicon')

# Ensure NLTK resources are downloaded
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
except Exception as e:
    logger.error(f"Failed to download NLTK resources: {e}")

# Load spaCy language models
NLP_MODELS = {}

def load_spacy_model(lang_code):
    """Load a spaCy language model if not already loaded."""
    if lang_code in NLP_MODELS:
        return NLP_MODELS[lang_code]
    
    try:
        if lang_code == 'en':
            model_name = 'en_core_web_sm'
            model = spacy.load(model_name)
        elif lang_code == 'de':
            model_name = 'de_core_news_sm'
            model = spacy.load(model_name)
        elif lang_code == 'es':
            model_name = 'es_core_news_sm'
            model = spacy.load(model_name)
        elif lang_code == 'fr' or lang_code == 'pt':  # Portuguese uses French as fallback
            model_name = 'fr_core_news_sm'
            model = spacy.load(model_name)
        else:
            # Default to English for unsupported languages
            model_name = 'en_core_web_sm'
            model = spacy.load(model_name)
        
        NLP_MODELS[lang_code] = model
        return model
    except OSError as e:
        logger.error(f"Failed to load spaCy model '{model_name}' for language '{lang_code}': {e}")
        # Try loading a simpler model as fallback
        try:
            model = spacy.blank(lang_code)
            NLP_MODELS[lang_code] = model
            return model
        except Exception:
            # Last resort - load English model
            try:
                model = spacy.load('en_core_web_sm')
                NLP_MODELS[lang_code] = model
                return model
            except Exception:
                logger.error(f"Couldn't load any language model as fallback")
                return None

class TextAnalyzer:
    """Utility class for analyzing text responses and extracting insights."""
    
    def __init__(self, language='en'):
        self.language = language
        self.sentiment_analyzer = SentimentIntensityAnalyzer()
        self.lemmatizer = WordNetLemmatizer()
        
        # Get stopwords for the specified language (fallback to English)
        try:
            self.stop_words = set(stopwords.words(language))
        except:
            self.stop_words = set(stopwords.words('english'))
    
    def clean_text(self, text):
        """Clean and normalize text for analysis."""
        if not text:
            return ""
            
        # Convert to lowercase
        text = text.lower()
        
        # Remove punctuation
        text = text.translate(str.maketrans('', '', string.punctuation))
        
        # Remove numbers
        text = re.sub(r'\d+', '', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def extract_words(self, text, min_length=3):
        """Extract significant words from text, removing stopwords."""
        if not text:
            return []
            
        cleaned_text = self.clean_text(text)
        tokens = word_tokenize(cleaned_text)
        
        # Filter out stopwords and short words
        significant_words = [
            self.lemmatizer.lemmatize(word) 
            for word in tokens 
            if word not in self.stop_words and len(word) >= min_length
        ]
        
        return significant_words
    
    def get_word_frequencies(self, text):
        """Calculate word frequencies in the text."""
        words = self.extract_words(text)
        return Counter(words)
    
    def get_sentiment_score(self, text):
        """Calculate sentiment score for text (-1 to 1 scale)."""
        if not text:
            return 0.0
            
        sentiment = self.sentiment_analyzer.polarity_scores(text)
        return sentiment['compound']  # Compound score from -1 to 1
    
    def get_word_sentiment(self, word, context=None):
        """Calculate sentiment for a specific word, with optional context."""
        if context:
            # If context is provided, analyze word in context
            # Find the word in the context and get surrounding text
            pattern = r'.{0,50}' + re.escape(word) + r'.{0,50}'
            match = re.search(pattern, context, re.IGNORECASE)
            if match:
                word_context = match.group(0)
                return self.get_sentiment_score(word_context)
        
        # Fallback to just analyzing the word itself
        return self.get_sentiment_score(word)


def cluster_responses(text_responses, min_samples=2, eps=0.5):
    """
    Cluster similar text responses using DBSCAN algorithm.
    
    Args:
        text_responses: List of text strings to cluster
        min_samples: Minimum samples for a core point
        eps: Maximum distance between samples in same neighborhood
        
    Returns:
        Dictionary with cluster labels as keys and lists of text indices as values
    """
    if not text_responses or len(text_responses) < min_samples:
        return {}
    
    # Convert text to numerical features using TF-IDF
    vectorizer = TfidfVectorizer(max_features=100)
    features = vectorizer.fit_transform(text_responses)
    
    # Apply DBSCAN clustering
    db = DBSCAN(eps=eps, min_samples=min_samples)
    labels = db.fit_predict(features)
    
    # Group indices by cluster label
    clusters = {}
    for i, label in enumerate(labels):
        if label not in clusters:
            clusters[label] = []
        clusters[label].append(i)
    
    return clusters


def calculate_stats_from_scores(scores):
    """Calculate statistical measures from a list of scores."""
    if not scores:
        return {
            'average': 0,
            'median': 0,
            'conf_low': 0,
            'conf_high': 0,
            'min': 0,
            'max': 0,
            'count': 0
        }
    
    n = len(scores)
    avg = sum(scores) / n
    
    # Calculate median
    median = statistics.median(scores)
    
    # Calculate standard deviation
    stdev = statistics.stdev(scores) if n > 1 else 0
    
    # Calculate 95% confidence interval
    conf_margin = 1.96 * (stdev / math.sqrt(n)) if n > 0 else 0
    conf_low = avg - conf_margin
    conf_high = avg + conf_margin
    
    return {
        'average': avg,
        'median': median,
        'conf_low': conf_low,
        'conf_high': conf_high,
        'min': min(scores),
        'max': max(scores),
        'count': n
    }


def calculate_satisfaction_score(nps_ratings):
    """
    Calculate satisfaction score based on NPS methodology.
    Score = (% Promoters - % Detractors)
    
    Promoters: 9-10
    Passives: 7-8
    Detractors: 0-6
    """
    if not nps_ratings:
        return {
            'score': 0,
            'promoters': 0,
            'passives': 0,
            'detractors': 0,
            'promoters_pct': 0,
            'passives_pct': 0,
            'detractors_pct': 0
        }
    
    total = len(nps_ratings)
    promoters = sum(1 for score in nps_ratings if score >= 9)
    passives = sum(1 for score in nps_ratings if 7 <= score <= 8)
    detractors = sum(1 for score in nps_ratings if score <= 6)
    
    promoters_pct = (promoters / total) * 100 if total > 0 else 0
    passives_pct = (passives / total) * 100 if total > 0 else 0
    detractors_pct = (detractors / total) * 100 if total > 0 else 0
    
    score = promoters_pct - detractors_pct
    
    return {
        'score': score,
        'promoters': promoters,
        'passives': passives,
        'detractors': detractors,
        'promoters_pct': promoters_pct,
        'passives_pct': passives_pct,
        'detractors_pct': detractors_pct
    }

def process_text(text, language='en'):
    """
    Process a text string by normalizing, removing stop words, and lemmatizing.
    Returns a list of processed words.
    """
    # Load the appropriate language resources
    processed_words = []
    
    try:
        # Use appropriate spaCy model based on language code
        nlp = load_spacy_model(language)
        if not nlp:
            logger.warning(f"Failed to load spaCy model for language: {language}")
            return processed_words
        
        # Load stop words for the selected language
        try:
            stop_words = set(stopwords.words(LANGUAGE_MAPPING.get(language, 'english')))
        except Exception as e:
            logger.warning(f"Failed to load stopwords for {language}: {str(e)}")
            stop_words = set()  # Fallback to empty set if no stopwords available
        
        # Process the text using spaCy
        doc = nlp(text)
        
        # Extract words, filter out stop words, punctuation, and short words
        for token in doc:
            word = token.lemma_.lower()
            
            # Skip stop words, punctuation, and short words (less than 3 characters)
            if (word not in stop_words and 
                not token.is_punct and 
                not token.is_space and 
                len(word) >= 3):
                processed_words.append(word)
        
        return processed_words
        
    except Exception as e:
        logger.error(f"Error processing text: {str(e)}")
        return processed_words

def assign_clusters_to_words(text, processed_words, language='en'):
    """
    Assign clusters to words without saving to the database
    Args:
        text: The text to process
        processed_words: List of already processed words
        language: Language code of the text
    Returns:
        Dictionary mapping words to their assigned clusters
    """
    import json
    from openai import OpenAI
    import os
    from .models import CustomWordCluster
    
    try:
        # Get custom clusters to use for assignment
        clusters = list(CustomWordCluster.objects.filter(is_active=True).values_list('name', flat=True))
        if not clusters:
            logger.warning("No active custom clusters found for assignment")
            clusters = ["Other"]  # Default if no custom clusters exist
        
        # Check if we have any words to process
        if not processed_words:
            logger.warning("No processed words provided for cluster assignment")
            return {}
        
        # Call the OpenAI function with text data
        try:
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                logger.error("OPENAI_API_KEY not found in environment variables")
                return {}
                
            client = OpenAI(api_key=api_key)
            
            # Read the system prompt
            with open(os.path.join(os.path.dirname(__file__), 'survey_extract_prompt.txt'), 'r') as file:
                system_prompt = file.read()
            
            # Prepare the message - we don't have survey data here so just use simple placeholders
            user_message = f"Text: {text}\nList of Words: {processed_words}"
            
            # Call the OpenAI API
            completion = client.chat.completions.create(
                model="gpt-4o",  # Or another suitable model
                messages=[
                    {"role": "system", "content": system_prompt.replace("change_cluster", str(clusters))},
                    {"role": "user", "content": user_message}
                ],
                response_format={"type": "json_object"}
            )
            
            # Parse the response
            result = completion.choices[0].message.content
            word_to_cluster = {}
            
            try:
                result_json = json.loads(result)
                word_assignments = []
                
                # Handle different response formats
                if "word_assignments" in result_json:
                    # Original expected format
                    word_assignments = result_json.get("word_assignments", [])
                elif isinstance(result_json, dict):
                    # Handle flat key-value format or other formats
                    for word, cluster in result_json.items():
                        # Skip metadata keys that aren't actual words
                        if word in ['detailed', 'response', 'explanation', 'metadata']:
                            continue
                            
                        # Add to word assignments using the standard format
                        word_assignments.append({
                            "word": word,
                            "assigned_cluster": cluster
                        })
                    
                    # If still empty and we have a simplified response
                    if not word_assignments and len(result_json) <= 2:
                        # Use the last key-value as a fallback 
                        # (often 'response' contains the actual cluster)
                        cluster_value = list(result_json.values())[-1]
                        if cluster_value and isinstance(cluster_value, str):
                            # Assign all words to this cluster
                            for word in processed_words:
                                word_assignments.append({
                                    "word": word,
                                    "assigned_cluster": cluster_value
                                })
                
                # Convert assignments to a simple word-to-cluster mapping
                for assignment in word_assignments:
                    word = assignment.get("word")
                    assigned_cluster = assignment.get("assigned_cluster")
                    if word and assigned_cluster:
                        word_to_cluster[word] = assigned_cluster
                        
                return word_to_cluster
                
            except json.JSONDecodeError:
                logger.error(f"Failed to parse OpenAI response as JSON: {result}")
                return {}
                
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {str(e)}")
            return {}
            
    except Exception as e:
        logger.error(f"Error assigning clusters to words: {str(e)}")
        return {}

def analyze_response_clusters(response):
    """
    Analyze a response to identify custom word clusters and their associated NPS scores.
    Returns a dictionary of cluster statistics including sentiment scores, frequencies, and NPS data.
    """
    result = {}
    try:
        # Get all words associated with this response
        response_words = response.extracted_words.all()
        
        if not response_words:
            logging.warning(f"No extracted words found for response {response.id}")
            return result
        
        # Get all the answers for this response to extract NPS ratings
        answers = response.answers.all()
        nps_ratings = [answer.nps_rating for answer in answers if answer.nps_rating is not None]
        avg_nps = sum(nps_ratings) / len(nps_ratings) if nps_ratings else None
        
        # Get distinct clusters and their frequencies
        cluster_stats = {}
        
        for word in response_words:
            # Process regular clusters
            for cluster in word.clusters.all():
                if cluster.name not in cluster_stats:
                    cluster_stats[cluster.name] = {
                        'sentiment_sum': 0,
                        'frequency': 0,
                        'words': [],
                        'nps_scores': nps_ratings,
                        'avg_nps': avg_nps
                    }
                
                cluster_stats[cluster.name]['sentiment_sum'] += word.sentiment_score
                cluster_stats[cluster.name]['frequency'] += 1
                cluster_stats[cluster.name]['words'].append(word.word)
            
            # Process custom clusters
            for custom_cluster in word.custom_clusters.all():
                if custom_cluster.name not in cluster_stats:
                    cluster_stats[custom_cluster.name] = {
                        'sentiment_sum': 0,
                        'frequency': 0,
                        'words': [],
                        'nps_scores': nps_ratings,
                        'avg_nps': avg_nps,
                        'is_custom': True
                    }
                
                cluster_stats[custom_cluster.name]['sentiment_sum'] += word.sentiment_score
                cluster_stats[custom_cluster.name]['frequency'] += 1
                cluster_stats[custom_cluster.name]['words'].append(word.word)
        
        # Calculate average sentiment for each cluster and categorize
        for cluster_name, stats in cluster_stats.items():
            avg_sentiment = stats['sentiment_sum'] / stats['frequency'] if stats['frequency'] > 0 else 0
            stats['avg_sentiment'] = avg_sentiment
            
            # Determine category based on NPS or sentiment
            if avg_nps is not None:
                if avg_nps >= 9:
                    stats['category'] = 'positive'
                elif avg_nps <= 6:
                    stats['category'] = 'negative'
                else:
                    stats['category'] = 'neutral'
            else:
                if avg_sentiment > 0.3:
                    stats['category'] = 'positive'
                elif avg_sentiment < -0.3:
                    stats['category'] = 'negative'
                else:
                    stats['category'] = 'neutral'
        
        result = cluster_stats
    except Exception as e:
        logging.error(f"Error analyzing clusters for response {response.id}: {str(e)}")
    
    return result

def process_survey_and_assign_clusters(response_id):
    """
    Process a survey response to assign clusters to extracted words
    Args:
        response_id: The ID of the Response object to process
    """
    from .models import Response, CustomWordCluster, ResponseWord
    
    try:
        # Get the response and its associated answer and survey
        response = Response.objects.get(id=response_id)
        
        # Verify response has text answers to process
        if not response.answers.filter(text_answer__isnull=False).exists():
            logger.warning(f"Response {response_id} has no text answers to process")
            return
            
        # Get custom clusters to use for assignment
        clusters = list(CustomWordCluster.objects.filter(is_active=True).values_list('name', flat=True))
        if not clusters:
            logger.warning("No active custom clusters found for assignment")
            clusters = []  # Default if no custom clusters exist
            
        # Process each text answer in the response
        for answer in response.answers.filter(text_answer__isnull=False):
            # Skip empty answers
            if not answer.text_answer.strip():
                continue
                
            # Get the survey question
            question_text = ""
            if hasattr(answer.question, 'questions'):
                # Get question text in the response language or fall back to English
                lang_code = response.language
                if lang_code in answer.question.questions:
                    question_text = answer.question.questions[lang_code]
                elif 'en' in answer.question.questions:  # Fallback to English
                    question_text = answer.question.questions['en']
                    
            # Get all extracted words for this answer
            extracted_words = list(answer.extracted_words.values_list('word', flat=True))
            if not extracted_words:
                logger.warning(f"No extracted words found for answer {answer.id}")
                continue
                
            # Get survey name
            survey_name = answer.question.survey.description
                
            # Call the OpenAI function with survey data
            try:
                api_key = os.environ.get("OPENAI_API_KEY")
                if not api_key:
                    logger.error("OPENAI_API_KEY not found in environment variables")
                    return
                    
                client = OpenAI(api_key=api_key)
                
                # Read the system prompt
                with open(os.path.join(os.path.dirname(__file__), 'survey_extract_prompt.txt'), 'r') as file:
                    system_prompt = file.read()
                
                # Prepare the message
                user_message = f"Survey Name: {survey_name}\n" \
                               f"Survey Question: {question_text}\n" \
                               f"Survey Answer: {answer.text_answer}\n" \
                               f"List of Words: {extracted_words}"
                
                print(user_message)
                
                # Get custom clusters to use for assignment
                clusters = list(CustomWordCluster.objects.filter(is_active=True).values_list('name', flat=True))
                if not clusters:
                    logger.warning("No active custom clusters found for assignment")
                    clusters = []  # Default if no custom clusters exist

                # Call the OpenAI API
                completion = client.chat.completions.create(
                    model="gpt-4o",  # Or another suitable model
                    messages=[
                        {"role": "system", "content": system_prompt.replace("change_cluster", str(clusters))},
                        {"role": "user", "content": user_message}
                    ],
                    response_format={"type": "json_object"}
                )
                
                # Parse the response
                result = completion.choices[0].message.content
                try:
                    result_json = json.loads(result)
                    word_assignments = []
                    
                    # Handle different response formats
                    if "word_assignments" in result_json:
                        # Original expected format
                        word_assignments = result_json.get("word_assignments", [])
                    elif isinstance(result_json, dict):
                        # Handle flat key-value format or other formats
                        for word, cluster in result_json.items():
                            # Skip metadata keys that aren't actual words
                            if word in ['detailed', 'response', 'explanation', 'metadata']:
                                continue
                                
                            # Add to word assignments using the standard format
                            word_assignments.append({
                                "word": word,
                                "assigned_cluster": cluster
                            })
                        
                        # If still empty and we have a simplified response
                        if not word_assignments and len(result_json) <= 2:
                            # Use the last key-value as a fallback 
                            # (often 'response' contains the actual cluster)
                            cluster_value = list(result_json.values())[-1]
                            if cluster_value and isinstance(cluster_value, str):
                                # Assign all words to this cluster
                                for word in extracted_words:
                                    word_assignments.append({
                                        "word": word,
                                        "assigned_cluster": cluster_value
                                    })
                    
                    # Update each word with its assigned cluster
                    for assignment in word_assignments:
                        word = assignment.get("word")
                        assigned_cluster = assignment.get("assigned_cluster")
                        
                        if word and assigned_cluster:
                            # Check if this cluster already exists, if not create it
                            cluster_obj, created = CustomWordCluster.objects.get_or_create(
                                name=assigned_cluster,
                                defaults={
                                    'created_by': response.survey.created_by,
                                    'is_active': True,
                                    'description': f'Auto-created cluster from survey {response.survey.description}'
                                }
                            )
                            
                            # Update all instances of this word in the current answer
                            word_instances = ResponseWord.objects.filter(
                                answer=answer,
                                word=word
                            )
                            
                            for word_instance in word_instances:
                                word_instance.assigned_cluster = assigned_cluster
                                word_instance.save()
                                
                                # Associate the word with the custom cluster
                                word_instance.custom_clusters.add(cluster_obj)
                            
                    logger.info(f"Successfully assigned clusters for answer {answer.id}")
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse OpenAI response as JSON: {result}")
                    
            except Exception as e:
                logger.error(f"Error calling OpenAI API: {str(e)}")
                
    except Response.DoesNotExist:
        logger.error(f"Response with ID {response_id} does not exist")
    except Exception as e:
        logger.error(f"Error processing survey response {response_id}: {str(e)}") 