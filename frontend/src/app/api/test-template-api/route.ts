import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { cookies } from 'next/headers'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

type ApiResult = {
  status: number;
  statusText: string;
  error: string | null;
};

export async function GET(request: Request) {
  try {
    // Get template ID from query params
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id') || '1';
    
    // Check session
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({
        status: 'error',
        message: 'Not authenticated',
        session: null
      }, { status: 401 });
    }
    
    // Test template endpoints
    const results: {
      templatesList: ApiResult;
      templateDetail: ApiResult;
    } = {
      templatesList: { status: 0, statusText: '', error: null },
      templateDetail: { status: 0, statusText: '', error: null }
    };
    
    // Test list templates endpoint
    try {
      console.log('Testing /api/surveys/templates/ endpoint');
      const templatesResponse = await fetch(`${BACKEND_URL}/api/surveys/templates/`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.accessToken || ''}`
        }
      });
      
      results.templatesList.status = templatesResponse.status;
      results.templatesList.statusText = templatesResponse.statusText;
      
      if (!templatesResponse.ok) {
        const errorText = await templatesResponse.text();
        results.templatesList.error = errorText;
      }
    } catch (error: any) {
      results.templatesList.error = error.message;
    }
    
    // Test template detail endpoint
    try {
      console.log(`Testing /api/surveys/templates/${templateId}/ endpoint`);
      const templateResponse = await fetch(`${BACKEND_URL}/api/surveys/templates/${templateId}/`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.accessToken || ''}`
        }
      });
      
      results.templateDetail.status = templateResponse.status;
      results.templateDetail.statusText = templateResponse.statusText;
      
      if (!templateResponse.ok) {
        const errorText = await templateResponse.text();
        results.templateDetail.error = errorText;
      }
    } catch (error: any) {
      results.templateDetail.error = error.message;
    }
    
    return NextResponse.json({
      status: 'success',
      message: 'API test completed',
      backendUrl: BACKEND_URL,
      results
    });
  } catch (error: any) {
    console.error('Error in test template API route:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Internal server error',
      stack: error.stack
    }, { status: 500 });
  }
} 