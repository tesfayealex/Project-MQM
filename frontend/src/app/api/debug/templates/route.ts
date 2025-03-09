import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    
    // Test both template endpoints
    const results = {
      templatesListUrl: `${BACKEND_URL}/api/surveys/templates/`,
      templateDetailUrl: id ? `${BACKEND_URL}/api/surveys/templates/${id}/` : null,
      templatesListResponse: null as any,
      templateDetailResponse: null as any,
      error: null as string | null
    };
    
    // Test templates list endpoint
    try {
      console.log(`Fetching templates list from ${results.templatesListUrl}`);
      const listResponse = await fetch(results.templatesListUrl, {
        headers: {
          'Authorization': `Bearer ${session.accessToken || ''}`
        },
        credentials: 'include'
      });
      
      results.templatesListResponse = {
        status: listResponse.status,
        statusText: listResponse.statusText
      };
      
      if (listResponse.ok) {
        results.templatesListResponse.data = await listResponse.json();
      } else {
        results.templatesListResponse.error = await listResponse.text();
      }
    } catch (error: any) {
      results.templatesListResponse = {
        error: error.message || 'Error fetching templates list'
      };
    }
    
    // Test template detail endpoint if ID is provided
    if (id) {
      try {
        console.log(`Fetching template detail from ${results.templateDetailUrl}`);
        const detailResponse = await fetch(results.templateDetailUrl!, {
          headers: {
            'Authorization': `Bearer ${session.accessToken || ''}`
          },
          credentials: 'include'
        });
        
        results.templateDetailResponse = {
          status: detailResponse.status,
          statusText: detailResponse.statusText
        };
        
        if (detailResponse.ok) {
          results.templateDetailResponse.data = await detailResponse.json();
        } else {
          results.templateDetailResponse.error = await detailResponse.text();
        }
      } catch (error: any) {
        results.templateDetailResponse = {
          error: error.message || 'Error fetching template detail'
        };
      }
    }
    
    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error in debug templates route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 