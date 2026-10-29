import { ImageResponse } from 'next/og';
import { site } from '@/content/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: 96,
          background: '#07090f',
          color: '#e8ecf5',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#22d3ee' }} />
          <div style={{ fontSize: 40, fontWeight: 700 }}>{site.name}</div>
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, maxWidth: 900, lineHeight: 1.15 }}>{site.tagline}</div>
      </div>
    ),
    size,
  );
}
