import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create object to store status and responses
    const responses = {
      clusters: { status: 0, statusText: '' },
      templates: { status: 0, statusText: '' }
    };

    // Test custom clusters endpoint
    try {
      const clustersResponse = await fetch(`${BACKEND_URL}/api/surveys/custom-clusters/`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.accessToken || ''}`
        }
      });
      
      responses.clusters.status = clustersResponse.status;
      responses.clusters.statusText = clustersResponse.statusText;
    } catch (error: any) {
      console.error('Error fetching clusters:', error);
      responses.clusters.statusText = error.message;
    }

    // Test templates endpoint
    try {
      const templatesResponse = await fetch(`${BACKEND_URL}/api/surveys/templates/`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.accessToken || ''}`
        }
      });
      
      responses.templates.status = templatesResponse.status;
      responses.templates.statusText = templatesResponse.statusText;
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      responses.templates.statusText = error.message;
    }

    // Return both responses
    return NextResponse.json({
      backend_url: BACKEND_URL,
      responses
    });
  } catch (error: any) {
    console.error('Error in test backend route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
} 