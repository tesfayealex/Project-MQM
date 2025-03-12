'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPublicSurvey, submitSurveyResponse } from '@/lib/services/survey-service';
import { Survey, SurveyQuestion } from '@/types/survey';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Answer {
  question: string;
  nps_rating?: number;
  text_answer?: string;
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function PublicSurvey({ params }: PageProps) {
  const resolvedParams = React.use(params);
  const { token } = resolvedParams;
  const router = useRouter();
  const { toast } = useToast();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    async function loadSurvey() {
      try {
        const data = await getPublicSurvey(token);
        setSurvey(data);
        
        if (data.languages && data.languages.length > 0) {
          const browserLang = navigator.language.split('-')[0];
          const matchedLang = data.languages.find(lang => lang === browserLang) || data.languages[0];
          setCurrentLanguage(matchedLang);
        }
        
        if (data.questions && data.questions.length > 0) {
          setAnswers(data.questions.map(q => ({ 
            question: q.id || ''
          })));
        }

        // Check if survey has not started yet
        const hasStartDatePassed = data.start_datetime ? new Date(data.start_datetime) <= new Date() : true;
        
        if (!hasStartDatePassed) {
          // Store survey data for start message
          sessionStorage.setItem('surveyNotStarted', 'true');
          sessionStorage.setItem('surveyTitle', data.title);
          sessionStorage.setItem('surveyLanguage', currentLanguage);
          
          // Store start messages
          if (data.start_survey_titles && typeof data.start_survey_titles === 'object') {
            const startTitle = data.start_survey_titles[currentLanguage] || data.start_survey_titles['en'] || 'Survey Not Started Yet';
            sessionStorage.setItem('startSurveyTitle', startTitle);
          } else {
            sessionStorage.setItem('startSurveyTitle', 'Survey Not Started Yet');
          }
          
          if (data.start_survey_texts && typeof data.start_survey_texts === 'object') {
            const startMessage = data.start_survey_texts[currentLanguage] || data.start_survey_texts['en'] || 'This survey is not accepting responses yet. Please check back later.';
            sessionStorage.setItem('startSurveyMessage', startMessage);
          } else {
            sessionStorage.setItem('startSurveyMessage', 'This survey is not accepting responses yet. Please check back later.');
          }
          
          // Navigate to thanks page (which will handle displaying the start message)
          router.push('/survey/thanks');
          return;
        }
        
        // Check if survey has expired or is inactive
        const isExpiredByDate = data.expiry_date ? new Date(data.expiry_date) < new Date() : false;
        if (isExpiredByDate || !data.is_active) {
          // Store survey data for expired message
          sessionStorage.setItem('surveyExpired', 'true');
          sessionStorage.setItem('surveyTitle', data.title);
          sessionStorage.setItem('surveyLanguage', currentLanguage);
          
          // Store expired messages
          if (data.expired_survey_titles && typeof data.expired_survey_titles === 'object') {
            const expiredTitle = data.expired_survey_titles[currentLanguage] || data.expired_survey_titles['en'] || 'Survey Has Expired';
            sessionStorage.setItem('expiredSurveyTitle', expiredTitle);
          }
          
          if (data.expired_survey_texts && typeof data.expired_survey_texts === 'object') {
            const expiredMessage = data.expired_survey_texts[currentLanguage] || data.expired_survey_texts['en'] || 'This survey is no longer accepting responses.';
            sessionStorage.setItem('expiredSurveyMessage', expiredMessage);
          }
          
          // Navigate to thanks page
          router.push('/survey/thanks');
          return;
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading survey:', err);
        // If the error is due to expiration, handle it gracefully
        if (err.status === 400 && err.data?.detail?.includes('expired')) {
          // Set default expired messages if we don't have the survey data
          sessionStorage.setItem('surveyExpired', 'true');
          sessionStorage.setItem('expiredSurveyTitle', 'Survey Has Expired');
          sessionStorage.setItem('expiredSurveyMessage', 'This survey is no longer accepting responses.');
          router.push('/survey/thanks');
          return;
        }
        setError(err.message || 'Failed to load survey');
        setLoading(false);
      }
    }

    loadSurvey();
  }, [token, router]);

  function handleLanguageChange(lang: string) {
    setCurrentLanguage(lang);
  }

  function handleNpsChange(questionId: string, value: number) {
    setAnswers(prev => 
      prev.map(a => a.question === questionId ? { ...a, nps_rating: value } : a)
    );
  }

  function handleTextChange(questionId: string, text: string) {
    setAnswers(prev => 
      prev.map(a => a.question === questionId ? { ...a, text_answer: text } : a)
    );
  }

  async function handleSubmit() {
    if (!survey) return;
    
    setSubmitting(true);
    
    try {
      const validAnswers = answers.filter(a => 
        (a.nps_rating !== undefined && a.nps_rating !== null) || 
        (a.text_answer !== undefined && a.text_answer.trim() !== '')
      );
      
      const requiredQuestions = survey.questions
        .filter(q => q.is_required)
        .map(q => q.id || '');
        
      const answeredRequired = validAnswers
        .filter(a => 
          requiredQuestions.includes(a.question) && 
          ((a.nps_rating !== undefined && a.nps_rating !== null) || 
           (a.text_answer !== undefined && a.text_answer.trim() !== ''))
        )
        .map(a => a.question);
        
      const missingRequired = requiredQuestions.filter(q => !answeredRequired.includes(q));
      
      if (missingRequired.length > 0) {
        const missingQuestionTexts = survey.questions
          .filter(q => missingRequired.includes(q.id || ''))
          .map(q => q.questions[currentLanguage] || q.questions.en || 'Untitled Question')
          .join(', ');
          
        toast({
          title: "Required questions missing",
          description: `Please answer all required questions: ${missingQuestionTexts}`,
          variant: "destructive"
        });
        setSubmitting(false);
        return;
      }
      
      const response = await submitSurveyResponse(
        survey.id, 
        validAnswers,
        currentLanguage
      );
      
      // Log the survey to see what properties are available
      console.log("Survey data:", survey);
      
      // Clear previous data to avoid mixing with old survey data
      sessionStorage.removeItem('endSurveyTitle');
      sessionStorage.removeItem('endSurveyMessage');
      sessionStorage.removeItem('expiredSurveyTitle');
      sessionStorage.removeItem('expiredSurveyMessage');
      
      // Basic survey info
      sessionStorage.setItem('surveyResponseId', response.response_id);
      sessionStorage.setItem('surveyTitle', survey.title || '');
      sessionStorage.setItem('surveyLanguage', currentLanguage);
      sessionStorage.setItem('surveyExpired', 'false');
      
      // Debug what we're trying to save
      console.log("End survey title object:", survey.end_survey_titles);
      console.log("End survey texts object:", survey.end_survey_texts);
      
      // Store end survey messages with additional safety checks
      try {
        // Store end survey messages
        if (survey.end_survey_titles && typeof survey.end_survey_titles === 'object') {
          const endTitle = survey.end_survey_titles[currentLanguage] || survey.end_survey_titles['en'] || '';
          if (endTitle) sessionStorage.setItem('endSurveyTitle', endTitle);
        }
        
        if (survey.end_survey_texts && typeof survey.end_survey_texts === 'object') {
          const endMessage = survey.end_survey_texts[currentLanguage] || survey.end_survey_texts['en'] || '';
          if (endMessage) sessionStorage.setItem('endSurveyMessage', endMessage);
        }

        // Store expired survey messages
        if (survey.expired_survey_titles && typeof survey.expired_survey_titles === 'object') {
          const expiredTitle = survey.expired_survey_titles[currentLanguage] || survey.expired_survey_titles['en'] || '';
          if (expiredTitle) sessionStorage.setItem('expiredSurveyTitle', expiredTitle);
        }

        if (survey.expired_survey_texts && typeof survey.expired_survey_texts === 'object') {
          const expiredMessage = survey.expired_survey_texts[currentLanguage] || survey.expired_survey_texts['en'] || '';
          if (expiredMessage) sessionStorage.setItem('expiredSurveyMessage', expiredMessage);
        }
        
        // If end messages aren't found, use defaults
        if (!sessionStorage.getItem('endSurveyTitle')) {
          sessionStorage.setItem('endSurveyTitle', 'Thank You for Your Feedback!');
        }
        
        if (!sessionStorage.getItem('endSurveyMessage')) {
          sessionStorage.setItem('endSurveyMessage', 
            'Your participation helps us improve our workshops and create better experiences for future attendees.');
        }

        // If expired messages aren't found, use defaults
        if (!sessionStorage.getItem('expiredSurveyTitle')) {
          sessionStorage.setItem('expiredSurveyTitle', 'Survey Has Expired');
        }

        if (!sessionStorage.getItem('expiredSurveyMessage')) {
          sessionStorage.setItem('expiredSurveyMessage', 
            'This survey is no longer accepting responses because it has reached its expiration date.');
        }
      } catch (err) {
        console.error("Error setting session storage:", err);
        // Use defaults if there was an error
        sessionStorage.setItem('endSurveyTitle', 'Thank You for Your Feedback!');
        sessionStorage.setItem('endSurveyMessage', 
          'Your participation helps us improve our workshops and create better experiences for future attendees.');
      }
      
      // Verify what was saved
      console.log("SessionStorage after save:", Object.fromEntries(
        Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])
      ));
      
      router.push('/survey/thanks');
      
    } catch (err: any) {
      console.error('Error submitting survey:', err);
      toast({
        title: "Submission failed",
        description: err.message || "Failed to submit your response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card className="p-8 max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Survey Not Found</h1>
          <p className="text-gray-700 mb-6">{error || "This survey is unavailable or has expired."}</p>
          <Button onClick={() => router.push('/')}>Return to Homepage</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
      <header className="bg-white">
        <div className="container mx-auto px-4 py-4" style={{ padding: '0px' }}>
          <div className="flex flex-col items-center justify-center">
            <Image
              src="/logo.png"
              alt="MQM Logo"
              width={200}
              height={200}
              className="mb-2"
              priority
            />
            <div className="text-center">
              <p className="text-sm text-gray-500">
                {survey.title}
              </p>
              {survey.languages.length > 1 && (
                <div className="flex justify-center mt-2">
                  {survey.languages.map(lang => (
                    <button 
                      key={lang} 
                      onClick={() => handleLanguageChange(lang)}
                      className={`text-xs mx-1 px-2 py-1 ${currentLanguage === lang 
                        ? 'font-bold text-black' 
                        : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl" style={{ maxWidth: '35rem', paddingTop: '0rem' }}>
        <div className="space-y-8">
          {survey.questions
            .sort((a, b) => a.order - b.order)
            .map((question, index) => {
              const questionText = question.questions[currentLanguage] || question.questions.en || 'Untitled Question';
              const placeholderText = question.placeholders?.[currentLanguage] || question.placeholders?.en || '';
              const answer = answers.find(a => a.question === (question.id || ''));

              return (
                <div key={question.id} className="question-container mb-10 pb-6 border-b border-gray-100">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-medium text-[#333333]">
                      {questionText}
                      {question.is_required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </h2>
                    
                    {survey.survey_texts?.[currentLanguage] && index === 0 && (
                      <p className="text-[#666666] text-base mb-4">
                        {survey.survey_texts[currentLanguage]}
                      </p>
                    )}

                    {question.type === 'nps' ? (
                      <div className="mt-4">
                        {placeholderText && (
                          <p className="text-[#666666] text-sm mb-2" style={{ 
                            fontSize: '15.2px',
                            whiteSpace: 'pre-line' // This preserves newlines
                          }}>
                            {placeholderText}
                          </p>
                        )}
                        <div className="px-2">
                          <input
                            type="range"
                            min="0"
                            max="10"
                            value={answer?.nps_rating || 0}
                            onChange={(e) => handleNpsChange(question.id || '', parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                          />
                          <div className="flex justify-between mt-1">
                            {[...Array(11)].map((_, i) => (
                              <span key={i} className="text-xs text-gray-500">{i}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <textarea
                          className="w-full min-h-[70px] p-3 rounded-lg border border-gray-200 focus:ring-1 focus:ring-black focus:border-transparent resize-none"
                          placeholder={placeholderText}
                          value={answer?.text_answer || ''}
                          onChange={(e) => handleTextChange(question.id || '', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        <div className="mt-8 flex flex-col items-center">
          <Button
            size="lg"
            disabled={submitting}
            onClick={handleSubmit}
            className="px-12 py-3 text-base font-medium bg-black hover:bg-gray-800 text-white rounded-full w-40"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : "Submit"}
          </Button>

          <div className="flex flex-col items-center mt-6">
            <div className="w-[60px] h-[60px] mb-5 border-2 border-[#c41e3a] rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" width="30" height="30" className="fill-[#c41e3a]">
                <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
              </svg>
            </div>
            <p className="text-sm text-gray-500 text-center mt-2">
              By using Our System you accept our <a href="#" className="text-blue-600 hover:underline">terms of use</a> and <a href="#" className="text-blue-600 hover:underline">policies</a>.
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-white mt-8">
        <div className="container mx-auto px-4 py-4">
          <div className="text-center text-gray-500 text-sm">
            <p>&copy; {new Date().getFullYear()} MQM Survey System</p>
            {survey.token && (
              <p className="mt-1">Survey ID: {survey.token}</p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}