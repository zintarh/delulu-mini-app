/**
 * Still, standalone SVG of Lulu (dreaming), for places that can't render the
 * React component: the generated Open Graph image and the app/favicon PNGs.
 * Mirrors <Lulu mood="dream"> in components/ds/art.tsx — keep the two in step.
 * `strokeScale` thickens outlines for tiny renders (favicons).
 */
export function luluSvg({ strokeScale = 1, wave = false }: { strokeScale?: number; wave?: boolean } = {}): string {
  const sw = (w: number) => +(w * strokeScale).toFixed(2);
  const ink = "#161615";
  const arm = wave
    ? `<ellipse cx="212" cy="104" rx="15" ry="26" transform="rotate(-32 212 104)" fill="url(#l)" stroke="${ink}" stroke-width="${sw(3.5)}"/>`
    : `<ellipse cx="204" cy="164" rx="15" ry="25" transform="rotate(-24 204 164)" fill="url(#l)" stroke="${ink}" stroke-width="${sw(3.5)}"/>`;
  const body = "M120 44C180 44 216 92 216 150C216 206 176 240 120 240C64 240 24 206 24 150C24 92 60 44 120 44Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-13 -6 266 266">
<defs>
<radialGradient id="b" cx="0.36" cy="0.28" r="0.82"><stop offset="0" stop-color="#FFF3B8"/><stop offset="0.32" stop-color="#FFDA4D"/><stop offset="0.68" stop-color="#F6C324"/><stop offset="1" stop-color="#D08F04"/></radialGradient>
<radialGradient id="s" cx="0.42" cy="0.38" r="0.66"><stop offset="0.72" stop-color="#9A5B00" stop-opacity="0"/><stop offset="1" stop-color="#9A5B00" stop-opacity="0.32"/></radialGradient>
<radialGradient id="l" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#FFE47E"/><stop offset="1" stop-color="#DFA00A"/></radialGradient>
<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3B51E"/><stop offset="1" stop-color="#C08404"/></linearGradient>
<radialGradient id="e" cx="0.42" cy="0.32" r="0.75"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E7E6DE"/></radialGradient>
<radialGradient id="i" cx="0.38" cy="0.32" r="0.7"><stop offset="0" stop-color="#6B4515"/><stop offset="0.55" stop-color="#2A1A08"/><stop offset="1" stop-color="${ink}"/></radialGradient>
<radialGradient id="c" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#F48FA8" stop-opacity="0.9"/><stop offset="1" stop-color="#F48FA8" stop-opacity="0"/></radialGradient>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6EDC9C"/><stop offset="1" stop-color="#1F9A5B"/></linearGradient>
</defs>
<ellipse cx="90" cy="236" rx="24" ry="13" fill="url(#f)" stroke="${ink}" stroke-width="${sw(3.5)}"/>
<ellipse cx="150" cy="236" rx="24" ry="13" fill="url(#f)" stroke="${ink}" stroke-width="${sw(3.5)}"/>
<ellipse cx="36" cy="164" rx="15" ry="25" transform="rotate(24 36 164)" fill="url(#l)" stroke="${ink}" stroke-width="${sw(3.5)}"/>
${arm}
<path d="${body}" fill="url(#b)" stroke="${ink}" stroke-width="${sw(4)}"/>
<path d="${body}" fill="url(#s)"/>
<ellipse cx="82" cy="88" rx="30" ry="16" transform="rotate(-28 82 88)" fill="#FFFFFF" opacity="0.5"/>
<path d="M118 46C114 30 120 16 134 12" fill="none" stroke="${ink}" stroke-width="${sw(4.5)}" stroke-linecap="round"/>
<path d="M134 12C142 0 162 -1 170 8C162 20 146 22 134 12Z" fill="url(#g)" stroke="${ink}" stroke-width="${sw(3)}" stroke-linejoin="round"/>
<circle cx="64" cy="166" r="17" fill="url(#c)"/>
<circle cx="176" cy="166" r="17" fill="url(#c)"/>
<path d="M78 100q14-8 28-2M134 98q14-6 28 2" fill="none" stroke="${ink}" stroke-width="${sw(4)}" stroke-linecap="round"/>
<ellipse cx="94" cy="132" rx="18" ry="23" fill="url(#e)" stroke="${ink}" stroke-width="${sw(3.5)}"/>
<ellipse cx="146" cy="132" rx="18" ry="23" fill="url(#e)" stroke="${ink}" stroke-width="${sw(3.5)}"/>
<circle cx="97" cy="122" r="11" fill="url(#i)"/>
<circle cx="149" cy="122" r="11" fill="url(#i)"/>
<circle cx="101" cy="117" r="4.2" fill="#FFFFFF"/>
<circle cx="153" cy="117" r="4.2" fill="#FFFFFF"/>
<path d="M106 172q14 13 28 0" fill="none" stroke="${ink}" stroke-width="${sw(4.5)}" stroke-linecap="round"/>
</svg>`;
}

/** Data URI for <img src> (e.g. inside next/og ImageResponse). */
export function luluSvgDataUri(opts?: Parameters<typeof luluSvg>[0]): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(luluSvg(opts))}`;
}
