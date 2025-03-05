from django.contrib import admin
from .models import Survey, Question, Response, Answer, WordCluster, CustomWordCluster, ResponseWord, SurveyAnalysisSummary, SurveyToken


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1
    fields = ['questions', 'placeholders', 'type', 'order', 'language', 'is_required']


class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 0
    readonly_fields = ['created_at']


@admin.register(Survey)
class SurveyAdmin(admin.ModelAdmin):
    list_display = ['title', 'get_languages', 'format', 'type', 'created_by', 'created_at', 'is_active']
    list_filter = ['format', 'type', 'is_active', 'created_at']
    search_fields = ['title', 'description']
    inlines = [QuestionInline]
    readonly_fields = ['created_at', 'updated_at']
    
    def get_languages(self, obj):
        return ", ".join(obj.languages)
    get_languages.short_description = 'Languages'


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['get_question_text', 'survey', 'type', 'language', 'order', 'is_required']
    list_filter = ['type', 'language', 'is_required', 'survey']
    search_fields = ['questions', 'survey__title']
    
    def get_question_text(self, obj):
        return obj.questions.get(obj.language, 'Untitled Question')[:50]
    get_question_text.short_description = 'Question'


@admin.register(Response)
class ResponseAdmin(admin.ModelAdmin):
    list_display = ['survey', 'language', 'created_at', 'session_id']
    list_filter = ['survey', 'language', 'created_at']
    search_fields = ['session_id', 'survey__title']
    inlines = [AnswerInline]
    readonly_fields = ['created_at']


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ['question', 'response', 'nps_rating', 'sentiment_score', 'created_at']
    list_filter = ['question__type', 'created_at']
    search_fields = ['text_answer', 'question__questions']
    readonly_fields = ['created_at']


@admin.register(WordCluster)
class WordClusterAdmin(admin.ModelAdmin):
    list_display = ['name', 'survey', 'sentiment_score', 'frequency', 'is_positive', 'is_negative', 'is_neutral']
    list_filter = ['survey', 'is_positive', 'is_negative', 'is_neutral']
    search_fields = ['name', 'description', 'survey__title']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(CustomWordCluster)
class CustomWordClusterAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_by', 'is_active', 'word_count', 'last_processed']
    list_filter = ['is_active', 'created_by']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at', 'word_count', 'last_processed']


@admin.register(ResponseWord)
class ResponseWordAdmin(admin.ModelAdmin):
    list_display = ['word', 'response', 'answer', 'frequency', 'sentiment_score', 'language']
    list_filter = ['language', 'created_at']
    search_fields = ['word', 'original_text']
    readonly_fields = ['created_at']
    filter_horizontal = ['clusters', 'custom_clusters']


@admin.register(SurveyAnalysisSummary)
class SurveyAnalysisSummaryAdmin(admin.ModelAdmin):
    list_display = ['survey', 'response_count', 'average_satisfaction', 'positive_percentage', 'negative_percentage', 'neutral_percentage']
    list_filter = ['last_updated']
    search_fields = ['survey__title']
    readonly_fields = ['last_updated']


@admin.register(SurveyToken)
class SurveyTokenAdmin(admin.ModelAdmin):
    list_display = ['token', 'survey', 'description', 'created_at']
    list_filter = ['created_at']
    search_fields = ['token', 'description', 'survey__title']
    readonly_fields = ['created_at']

