import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const response = await fetch(`${BACKEND_URL}/api/surveys/custom-clusters/`, {
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${session.accessToken || ''}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch custom clusters: ${response.statusText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error in custom clusters GET route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get request body
    const body = await request.json()
    
    const response = await fetch(`${BACKEND_URL}/api/surveys/custom-clusters/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken || ''}`
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
        throw new Error(jsonError.detail || `Failed to create custom cluster: ${response.statusText}`)
      } catch (parseError) {
        // If parsing fails, use the raw error text
        throw new Error(`Failed to create custom cluster: ${errorData || response.statusText}`)
      }
    }
    
    const data = await response.json()
    
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error in custom clusters POST route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
} 