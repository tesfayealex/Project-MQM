import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../auth/[...nextauth]/route'
import { cookies } from 'next/headers'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const cookieString = cookieStore.toString();
    
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const response = await fetch(`${BACKEND_URL}/api/surveys/custom-clusters/${id}/`, {
      method: 'DELETE',
      headers: {
        'Cookie': cookieString
      },
      credentials: 'include'
    })
    
    if (!response.ok) {
      throw new Error(`Failed to delete custom cluster: ${response.statusText}`)
    }
    
    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error('Error in custom cluster DELETE route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
} 