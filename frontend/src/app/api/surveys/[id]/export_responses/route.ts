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
    
    console.log(`==== EXPORT API ROUTE DEBUG ====`);
    console.log(`Processing export request for survey ID: ${id}`);
    
    const session = await getServerSession(authOptions);
    
    if (!session) {
      console.log('No session found - unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use the surveys/{id}/export_responses/ URL pattern for ViewSet action
    const url = `${BACKEND_URL}/api/surveys/surveys/${id}/export_responses/`;
    console.log(`Making request to backend: ${url}`);
    console.log(`Session token available: ${!!session.accessToken}`);
    
    try {
      console.log(`Headers being sent to backend:`, {
        'Authorization': `Bearer ${session.accessToken ? session.accessToken.substring(0, 10) + '...' : 'none'}`,
        'Cookie': cookieString ? 'present' : 'none'
      });

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.accessToken || ''}`,
          'Cookie': cookieString,
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
        credentials: 'include'
      });
      
      console.log(`Backend response status: ${response.status} ${response.statusText}`);
      
      if (response.headers) {
        const headers = Object.fromEntries([...response.headers.entries()]);
        console.log(`Response headers: ${JSON.stringify(headers)}`);
      }
      
      if (!response.ok) {
        // Try to get more information from the error
        let errorBody = '';
        try {
          // Try to parse as JSON
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorJson = await response.json();
            errorBody = JSON.stringify(errorJson);
          } else {
            errorBody = await response.text();
          }
        } catch (parseError) {
          errorBody = 'Could not parse error response';
        }
        
        console.error(`Backend error response (${response.status}): ${errorBody || response.statusText}`);
        throw new Error(`Failed to export responses: ${errorBody || response.statusText}`);
      }
      
      // Get the Excel file as a buffer
      const excelBuffer = await response.arrayBuffer();
      console.log(`Received Excel file, size: ${excelBuffer.byteLength} bytes`);
      
      // Get the filename from Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
      console.log(`Content-Disposition header: ${contentDisposition}`);
      
      // Create response with the Excel file
      const nextResponse = new NextResponse(excelBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': contentDisposition || `attachment; filename="survey_${id}_responses.xlsx"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      });
      
      console.log('Successfully created NextResponse with Excel file');
      return nextResponse;
    } catch (fetchError: any) {
      console.error('Fetch error details:', fetchError);
      throw new Error(`Failed to fetch from backend: ${fetchError.message}`);
    }
    
  } catch (error: any) {
    console.error('Error in export responses route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
} 