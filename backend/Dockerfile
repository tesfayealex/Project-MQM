
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY requirements.txt /app/
# RUN pip install --upgrade pip && pip install -r requirements.txt && pip install gunicorn && \
#     python -m spacy download en_core_web_sm && \
#     python -m spacy download de_core_news_sm && \
#     python -m spacy download es_core_news_sm && \
#     python -m spacy download fr_core_news_sm
RUN pip install --upgrade pip && \
    pip install --cache-dir=/root/.cache/pip -r requirements.txt && \
    pip install --cache-dir=/root/.cache/pip gunicorn

# Download spaCy models. You could also consider moving this step after copying project files if it rarely changes.
RUN python -m spacy download en_core_web_sm && \
    python -m spacy download de_core_news_sm && \
    python -m spacy download es_core_news_sm && \
    python -m spacy download fr_core_news_sm

# Set NLTK data directory so that it's persisted
ENV NLTK_DATA=/root/nltk_data

# Download required nltk data packages during build time
RUN python -m nltk.downloader punkt stopwords wordnet vader_lexicon

# Copy project code
COPY . /app/

# (Optional) Collect static files if needed
# RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "mqm.wsgi:application", "--bind", "0.0.0.0:8000"]