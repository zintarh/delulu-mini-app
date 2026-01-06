import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract query parameters
    const title = searchParams.get('title') || 'My Delusion';
    const bgImage = searchParams.get('bgImage') || '';
    const font = searchParams.get('font') || 'Gloria Hallelujah';

    // Load Google Font (Gloria Hallelujah) - using direct TTF URL
    let fontBuffer: ArrayBuffer | null = null;
    try {
      // Direct URL to Gloria Hallelujah font file from Google Fonts
      const fontUrl = 'https://fonts.gstatic.com/s/gloriahallelujah/v17/LYjYdHv3mpUk54B3o3xJX6HdZyTt2kYQ.woff2';
      const fontResponse = await fetch(fontUrl);
      if (fontResponse.ok) {
        fontBuffer = await fontResponse.arrayBuffer();
      }
    } catch (error) {
      console.error('Failed to load font:', error);
      // Font will fallback to system fonts
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            position: 'relative',
          }}
        >
          {/* Background Image */}
          {bgImage && (
            <img
              src={bgImage}
              alt=""
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.7,
              }}
            />
          )}

          {/* Overlay for better text readability */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
            }}
          />

          {/* Title Text Overlay */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              padding: '80px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <h1
              style={{
                fontSize: 60,
                fontWeight: 'bold',
                color: '#FFFFFF',
                textAlign: 'center',
                fontFamily: font,
                textShadow: '0 4px 12px rgba(0, 0, 0, 0.8), 0 2px 4px rgba(0, 0, 0, 0.6)',
                lineHeight: 1.2,
                wordWrap: 'break-word',
                maxWidth: '1000px',
              }}
            >
              {title}
            </h1>
          </div>

          {/* Branding in bottom right */}
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              right: 40,
              fontSize: 24,
              fontWeight: 'bold',
              color: '#FCFF52',
              fontFamily: 'Gloria Hallelujah, cursive',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
              zIndex: 2,
            }}
          >
            Delulu.
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: fontBuffer
          ? [
              {
                name: 'Gloria Hallelujah',
                data: fontBuffer,
                style: 'normal',
              },
            ]
          : [],
      }
    );
  } catch (error) {
    console.error('OG image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
