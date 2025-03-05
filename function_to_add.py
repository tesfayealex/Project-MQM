import nltk
from nltk.stem.snowball import SnowballStemmer
from nltk.corpus import stopwords
import spacy

nlp = spacy.load('de_core_news_md') 

import nltk
nltk.download('punkt')
nltk.download('averaged_perceptron_tagger')
nltk.download('punkt_tab')
nltk.download('stopwords')

!python -m spacy download de_core_news_md

def process_text(text):
    """
    Processes input text and returns a single processed word.

    Args:
        text: The input text string.

    Returns:
        A single processed word (string) from the text, or None if no suitable word is found.
    """

    # 1. Get words_combined
    sentences = nltk.sent_tokenize(text, language='german')
    words_combined = []
    for sentence in sentences:
        words = nltk.word_tokenize(sentence, language='german')
        words_combined.extend(words)

    # print(f"Words: {words_combined}")
    # 2. Get consolidated_words
    
    doc = nlp(" ".join(words_combined))
    # print(doc)

    # Print each token's text and lemma
    # for token in doc:
        # print(token.text, "->", token.lemma_)
    consolidated_words = [word.lemma_ for word in doc if len(word.lemma_) > 1]
    # print(consolidated_words)

    # 3. Get cleaned_words
    german_stopwords = set(stopwords.words('german'))
    cleaned_words = [
        word.lower() for word in consolidated_words
        if word.isalpha() and word.lower() not in german_stopwords
    ]

    # 4. Get pos_filtered
    # nlp = spacy.load('de_core_news_md')  # Make sure you have this model downloaded
    doc = nlp(" ".join(cleaned_words))
    # pos_filtered = [token.text for token in doc if token.pos_ in ['NOUN', 'ADJ']]
    pos_filtered = [token.text for token in doc if token.tag_ in ['ADJD'] or token.pos_ in ['NOUN', 'ADJ']]

    # Return the first word from pos_filtered (or None if empty)
    return pos_filtered

result_word = process_text(text)
# print(result_word)  # Output: veranstaltung