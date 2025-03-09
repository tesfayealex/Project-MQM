
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt && pip install gunicorn && \
    python -m spacy download en_core_web_sm && \
    python -m spacy download de_core_news_sm && \
    python -m spacy download es_core_news_sm && \
    python -m spacy download fr_core_news_sm


# Copy project code
COPY . /app/

# (Optional) Collect static files if needed
# RUN python manage.py collectstatic --noinput

EXPOSE 8080

CMD ["gunicorn", "mqm.wsgi:application", "--bind", "0.0.0.0:8080"]