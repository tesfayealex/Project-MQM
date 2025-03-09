import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { cookies } from 'next/headers'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function POST(request: Request) {
  try {
    // Properly await cookies
    const cookieStore = await cookies();
    const cookieString = cookieStore.toString();
    
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get request body
    const body = await request.json()
    
    const response = await fetch(`${BACKEND_URL}/api/surveys/process-survey-responses/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString
      },
      credentials: 'include',
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      const errorData = await response.text()
      console.error('Backend error response:', errorData)
      
      try {
        // Try to parse the error as JSON
        const jsonError = JSON.parse(errorData)
        throw new Error(jsonError.detail || `Failed to process survey responses: ${response.statusText}`)
      } catch (parseError) {
        // If parsing fails, use the raw error text
        throw new Error(`Failed to process survey responses: ${errorData || response.statusText}`)
      }
    }
    
    const data = await response.json()
    
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error in process survey responses POST route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
} 