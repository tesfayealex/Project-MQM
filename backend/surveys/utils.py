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