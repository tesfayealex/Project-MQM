import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { id } = context.params;
    const cookieStore = cookies();
    const cookieString = cookieStore.toString();
    
    console.log(`==== TEST EXPORT API ROUTE ====`);
    console.log(`Testing export for survey ID: ${id}`);
    
    const session = await getServerSession(authOptions);
    
    if (!session) {
      console.log('No session found - unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = `${BACKEND_URL}/api/surveys/surveys/${id}/test-export/`;
    console.log(`Making request to backend test endpoint: ${url}`);
    console.log(`Session token available: ${!!session.accessToken}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${session.accessToken || ''}`,
        'Cookie': cookieString
      },
      credentials: 'include'
    });
    
    console.log(`Backend test response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend error response: ${errorText}`);
      throw new Error(`Test failed: ${response.statusText || errorText}`);
    }
    
    const data = await response.json();
    console.log(`Test response data:`, data);
    
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Error in test export route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
} 