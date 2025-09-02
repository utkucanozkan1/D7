import { NextRequest, NextResponse } from 'next/server';
import { Server } from 'http';
import { initializeSocketServer } from '@/lib/socket-server';

// This will be populated when the server starts
let httpServer: Server | null = null;

export async function GET(request: NextRequest) {
  try {
    // In development, we need to handle this differently
    // For production, you'd typically set this up in a custom server
    
    if (!global.socketIOInitialized) {
      // This is a workaround for development
      // In production, you should initialize Socket.IO in a custom server
      console.log('Socket.IO server initialization requested but no HTTP server available');
      console.log('Socket.IO will be initialized when the first WebSocket connection is made');
      global.socketIOInitialized = true;
    }

    return NextResponse.json({ 
      message: 'Socket.IO server is ready',
      status: 'initialized',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error initializing Socket.IO:', error);
    return NextResponse.json({ 
      error: 'Failed to initialize Socket.IO server',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // This endpoint can be used to trigger Socket.IO server initialization
    // or send server-side events if needed
    
    return NextResponse.json({ 
      message: 'Socket.IO server endpoint',
      received: body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in Socket.IO POST endpoint:', error);
    return NextResponse.json({ 
      error: 'Failed to process request'
    }, { status: 500 });
  }
}

// For development, we need to handle Socket.IO differently
// This is a simplified approach - in production you'd use a custom server
declare global {
  var socketIOInitialized: boolean | undefined;
}