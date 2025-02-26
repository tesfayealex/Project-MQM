from django.contrib import admin
from .models import Survey, Question, Response, Answer


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

