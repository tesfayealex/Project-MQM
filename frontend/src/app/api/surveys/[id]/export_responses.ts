import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = context.params;
  console.log(`==== REDIRECT HANDLER ====`);
  console.log(`Received request to /api/surveys/${id}/export_responses without trailing slash`);
  
  // Redirect to the version with trailing slash
  const url = new URL(request.url);
  const redirectUrl = new URL(`${url.pathname}/`, url.origin);
  
  console.log(`Redirecting from: ${url.pathname} to: ${redirectUrl.pathname}`);
  
  return NextResponse.redirect(redirectUrl.toString(), {
    status: 308, // 308 = Permanent Redirect
    headers: {
      'Location': redirectUrl.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
  });
} 