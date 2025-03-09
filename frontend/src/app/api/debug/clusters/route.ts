import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    
    // Test both custom clusters endpoints
    const results = {
      clustersListUrl: `${BACKEND_URL}/api/surveys/custom-clusters/`,
      activeClustersUrl: `${BACKEND_URL}/api/surveys/custom-clusters/active/`,
      clustersListResponse: null as any,
      activeClustersResponse: null as any,
      error: null as string | null
    };
    
    // Test clusters list endpoint
    try {
      console.log(`Fetching clusters list from ${results.clustersListUrl}`);
      const listResponse = await fetch(results.clustersListUrl, {
        headers: {
          'Authorization': `Bearer ${session.accessToken || ''}`
        },
        credentials: 'include'
      });
      
      results.clustersListResponse = {
        status: listResponse.status,
        statusText: listResponse.statusText
      };
      
      if (listResponse.ok) {
        results.clustersListResponse.data = await listResponse.json();
      } else {
        results.clustersListResponse.error = await listResponse.text();
      }
    } catch (error: any) {
      results.clustersListResponse = {
        error: error.message || 'Error fetching clusters list'
      };
    }
    
    // Test active clusters endpoint
    try {
      console.log(`Fetching active clusters from ${results.activeClustersUrl}`);
      const activeResponse = await fetch(results.activeClustersUrl, {
        headers: {
          'Authorization': `Bearer ${session.accessToken || ''}`
        },
        credentials: 'include'
      });
      
      results.activeClustersResponse = {
        status: activeResponse.status,
        statusText: activeResponse.statusText
      };
      
      if (activeResponse.ok) {
        results.activeClustersResponse.data = await activeResponse.json();
      } else {
        results.activeClustersResponse.error = await activeResponse.text();
      }
    } catch (error: any) {
      results.activeClustersResponse = {
        error: error.message || 'Error fetching active clusters'
      };
    }
    
    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error in debug clusters route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 