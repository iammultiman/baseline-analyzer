import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authMiddleware(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }

    const notificationId = params.id;
    
    // In a real implementation, you would delete the notification from the database
    // For now, we'll just return success since notifications are generated dynamically
    console.log(`Dismissing notification: ${notificationId} for user: ${auth.user.id}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification dismiss error:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss notification' },
      { status: 500 }
    );
  }
}