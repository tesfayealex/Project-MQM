'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import Image from 'next/image';
import { Clock } from 'lucide-react';

export default function ThankYouPage() {
  const [surveyTitle, setSurveyTitle] = useState<string>('');
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [pageTitle, setPageTitle] = useState<string>('Thank You for Your Feedback!');
  const [pageMessage, setPageMessage] = useState<string>('Your participation helps us improve our workshops and create better experiences for future attendees.');
  
  useEffect(() => {
    // Debug what's in sessionStorage when the page loads
    console.log("All sessionStorage items:", Object.fromEntries(
      Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])
    ));
    
    // Check if we have survey information in sessionStorage
    const title = sessionStorage.getItem('surveyTitle');
    const expired = sessionStorage.getItem('surveyExpired') === 'true';
    
    if (title) {
      setSurveyTitle(title);
    }
    
    setIsExpired(expired);
    
    // Set title and message based on expiration status
    if (expired) {
      const expiredTitle = sessionStorage.getItem('expiredSurveyTitle');
      const expiredMessage = sessionStorage.getItem('expiredSurveyMessage');
      
      console.log("Expired title from storage:", expiredTitle);
      console.log("Expired message from storage:", expiredMessage);
      
      if (expiredTitle) setPageTitle(expiredTitle);
      else setPageTitle('Survey Has Expired');
      
      if (expiredMessage) setPageMessage(expiredMessage);
      else setPageMessage('This survey is no longer accepting responses because it has reached its expiration date.');
    } else {
      const endTitle = sessionStorage.getItem('endSurveyTitle');
      const endMessage = sessionStorage.getItem('endSurveyMessage');
      
      console.log("End title from storage:", endTitle);
      console.log("End message from storage:", endMessage);
      
      if (endTitle) setPageTitle(endTitle);
      if (endMessage) setPageMessage(endMessage);
    }
    
    // Clear the storage after we've used it
    setTimeout(() => {
      sessionStorage.removeItem('surveyResponseId');
      sessionStorage.removeItem('surveyTitle');
      sessionStorage.removeItem('surveyLanguage');
      sessionStorage.removeItem('surveyExpired');
      sessionStorage.removeItem('endSurveyTitle');
      sessionStorage.removeItem('endSurveyMessage');
      sessionStorage.removeItem('expiredSurveyTitle');
      sessionStorage.removeItem('expiredSurveyMessage');
    }, 1000); // Small delay to ensure we don't clear before using
  }, []);
  
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
      <header className="bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col items-center justify-center">
            <Image
              src="/logo.png"
              alt="MQM Logo"
              width={200}
              height={200}
              className="mb-2"
              priority
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl" style={{ maxWidth: '35rem' }}>
        <Card className="p-12 shadow-xl text-center">
          <div className="flex justify-center mb-8">
            {isExpired ? (
              <div className="text-[#FF9800] text-6xl">
                <Clock size={64} />
              </div>
            ) : (
              <div className="text-[#4CAF50] text-6xl">✓</div>
            )}
          </div>
          
          <h1 className="text-3xl font-semibold text-[#333] mb-6">{pageTitle}</h1>
          
          <p className="text-lg text-[#555] mb-6 leading-relaxed">
            {pageMessage}
          </p>
          
          {/* {!isExpired && (
            <p className="text-lg text-[#555] leading-relaxed">
              We've recorded your response and will use it to enhance our programs.
            </p>
          )} */}
          
          {/* {surveyTitle && (
            <p className="text-lg text-gray-500 mt-4">
              Survey: "{surveyTitle}"
            </p>
          )} */}
        </Card>
      </main>

      <footer className="fixed bottom-0 w-full bg-white border-t">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center">
            <div className="w-[60px] h-[60px] mb-5 border-2 border-[#c41e3a] rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" width="30" height="30" className="fill-[#c41e3a]">
                <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
              </svg>
            </div>
            <p className="text-sm text-gray-500 text-center">
              By using Our System you accept our <a href="#" className="text-blue-600 hover:underline">terms of use</a> and <a href="#" className="text-blue-600 hover:underline">policies</a>.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}