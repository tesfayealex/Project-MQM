"""
Utilities for direct processing of survey responses with sentence-level sentiment analysis.
"""
import logging
import json
from django.utils import timezone
from django.db.models import Sum, Avg, Count, F, Q, FloatField, ExpressionWrapper
from django.db.models.functions import Cast

logger = logging.getLogger(__name__)

def direct_process_response(response_id):
    """
    Process a survey response directly, analyzing text answers at the sentence level
    and assigning clusters to extracted words based on their sentence context.
    
    Args:
        response_id: The ID of the Response to process
    """
    from .models import Response, Answer, ResponseWord, WordCluster, CustomWordCluster
    from .utils import assign_clusters_to_words, analyze_sentences_with_openai, process_sentence
    
    try:
        # Get the response and its associated survey
        response = Response.objects.get(id=response_id)
        survey = response.survey
        
        # Process each text answer in the response
        for answer in response.answers.filter(text_answer__isnull=False):
            # Skip empty answers or already processed answers
            if not answer.text_answer.strip() or answer.processed:
                continue
            
            # Get the language from the response
            language = response.language
            
            # 1. Analyze text at sentence level for sentiment
            sentence_data = analyze_sentences_with_openai(answer.text_answer, language)
            answer.sentence_sentiments = sentence_data
            
            # Initialize variables for word processing
            all_processed_words = []
            words_to_sentences = {}
            
            # 2. Process each sentence to extract words
            for sentence_info in sentence_data:
                sentence_text = sentence_info['text']
                sentence_idx = sentence_info['index']
                sentence_sentiment = sentence_info['sentiment']
                
                # Extract words from this sentence
                sentence_words = process_sentence(sentence_text, language)
                
                # Map each word to its source sentence and sentiment
                for word in sentence_words:
                    words_to_sentences[word] = {
                        'text': sentence_text,
                        'index': sentence_idx,
                        'sentiment': sentence_sentiment
                    }
                
                # Add to our complete list of processed words
                all_processed_words.extend(sentence_words)
            
            # 3. Assign clusters to words using the utility function
            word_clusters = assign_clusters_to_words(answer.text_answer, all_processed_words, language, survey)
            
            # 4. Create ResponseWord instances for each processed word
            for word in all_processed_words:
                # Get sentence data for this word
                sentence_data = words_to_sentences.get(word, {})
                sentence_text = sentence_data.get('text', '')
                sentence_idx = sentence_data.get('index', None)
                sentiment_score = sentence_data.get('sentiment', 0)
                
                # Get assigned cluster from word_clusters dictionary
                assigned_cluster = word_clusters.get(word, 'Other')
                
                # Create the ResponseWord instance
                response_word = ResponseWord.objects.create(
                    response=response,
                    answer=answer,
                    word=word,
                    original_text=answer.text_answer,
                    language=language,
                    sentence_text=sentence_text,
                    sentence_index=sentence_idx,
                    sentiment_score=sentiment_score,  # Use sentence-level sentiment for the word
                    assigned_cluster=assigned_cluster
                )
                
                # Find and associate with the matching custom cluster
                if assigned_cluster != 'Other':
                    try:
                        # Check if this cluster already exists, if not create it
                        cluster_obj, created = CustomWordCluster.objects.get_or_create(
                            name=assigned_cluster,
                            defaults={
                                'created_by': survey.created_by,
                                'is_active': True,
                                'description': f'Auto-created cluster from survey {survey.description}'
                            }
                        )
                        
                        response_word.custom_clusters.add(cluster_obj)
                        
                        # Update the last_processed timestamp for the cluster
                        cluster_obj.last_processed = timezone.now()
                        cluster_obj.save(update_fields=['last_processed'])
                        
                        # Update the word count
                        cluster_obj.update_word_count()
                        
                        # Create or update word clusters based on the sentiment of the sentence
                        is_positive = sentiment_score > 0.05
                        is_negative = sentiment_score < -0.05
                        is_neutral = not (is_positive or is_negative)
                        
                        category = 'positive' if is_positive else 'negative' if is_negative else 'neutral'
                        
                        # Get or create the word cluster for this survey
                        word_cluster, created = WordCluster.objects.get_or_create(
                            survey=survey,
                            name=assigned_cluster,
                            defaults={
                                'description': f'Cluster for "{assigned_cluster}" words',
                                'sentiment_score': sentiment_score,
                                'frequency': 1,
                                'is_positive': is_positive,
                                'is_negative': is_negative,
                                'is_neutral': is_neutral,
                                'category': category,
                                'custom_cluster_id': cluster_obj.id
                            }
                        )
                        
                        if not created:
                            # Update frequency and recalculate sentiment
                            word_cluster.frequency += 1
                            
                            # Update cumulative sentiment score
                            current_total = word_cluster.sentiment_score * (word_cluster.frequency - 1)
                            new_total = current_total + sentiment_score
                            word_cluster.sentiment_score = new_total / word_cluster.frequency
                            
                            # Update sentiment categories
                            if word_cluster.sentiment_score > 0.05:
                                word_cluster.is_positive = True
                                word_cluster.is_negative = False
                                word_cluster.is_neutral = False
                                word_cluster.category = 'positive'
                            elif word_cluster.sentiment_score < -0.05:
                                word_cluster.is_positive = False
                                word_cluster.is_negative = True
                                word_cluster.is_neutral = False
                                word_cluster.category = 'negative'
                            else:
                                word_cluster.is_positive = False
                                word_cluster.is_negative = False
                                word_cluster.is_neutral = True
                                word_cluster.category = 'neutral'
                            
                            word_cluster.save()
                        
                        # Associate word with the cluster
                        response_word.clusters.add(word_cluster)
                        
                    except Exception as e:
                        logger.error(f"Error associating word with cluster: {str(e)}")
            
            # 5. Mark answer as processed
            answer.processed = True
            answer.save(update_fields=['processed', 'sentence_sentiments'])
            
            logger.info(f"Successfully processed answer {answer.id} with {len(all_processed_words)} words")
        
        return True
        
    except Response.DoesNotExist:
        logger.error(f"Response with ID {response_id} does not exist")
        return False
    except Exception as e:
        logger.error(f"Error processing response {response_id}: {str(e)}")
        return False

def direct_process_all_responses(survey_id):
    """
    Process all responses for a survey with sentence-level sentiment analysis.
    
    Args:
        survey_id: The ID of the Survey to process
    """
    from .models import Survey, Response, Answer
    
    try:
        survey = Survey.objects.get(id=survey_id)
        responses = Response.objects.filter(survey=survey)
        
        logger.info(f"Processing {responses.count()} responses for survey {survey_id}")
        
        # Process responses with unprocessed text answers
        responses_to_process = []
        for response in responses:
            if response.answers.filter(text_answer__isnull=False, processed=False).exists():
                responses_to_process.append(response.id)
        
        logger.info(f"Found {len(responses_to_process)} responses needing processing")
        
        processed_count = 0
        for response_id in responses_to_process:
            success = direct_process_response(response_id)
            if success:
                processed_count += 1
        
        logger.info(f"Successfully processed {processed_count} responses for survey {survey_id}")
        
        # Update the survey analysis summary
        from .views import SurveyAnalysisViewSet
        analysis_view = SurveyAnalysisViewSet()
        summary = analysis_view._update_analysis_summary(survey.analysis_summary)
        
        logger.info(f"Updated analysis summary for survey {survey_id}")
        
        return {
            'success': True,
            'processed_count': processed_count,
            'total_responses': responses.count()
        }
        
    except Survey.DoesNotExist:
        logger.error(f"Survey with ID {survey_id} does not exist")
        return {
            'success': False,
            'error': f"Survey with ID {survey_id} does not exist"
        }
    except Exception as e:
        logger.error(f"Error processing survey {survey_id}: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        } 