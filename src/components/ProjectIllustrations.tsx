import React from 'react';

export const BuildingIllustration: React.FC<{
  type: string;
  className?: string;
}> = ({ type, className = 'w-full h-48' }) => {
  if (type === 'SVG_OFFICE_BUILDING') {
    return (
      <svg
        viewBox="0 0 600 320"
        className={`${className} bg-slate-900 select-none`}
        role="img"
        aria-label="Visualisasi Arsitektur Renovasi Kantor Pusat"
      >
        <defs>
          <linearGradient id="officeSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B1E3D" />
            <stop offset="100%" stopColor="#1E3A5F" />
          </linearGradient>
        </defs>
        <rect width="600" height="320" fill="url(#officeSky)" />
        {/* Blueprint grid */}
        <g stroke="#334155" strokeWidth="0.6" opacity="0.45">
          <line x1="0" y1="60" x2="600" y2="60" />
          <line x1="0" y1="120" x2="600" y2="120" />
          <line x1="0" y1="180" x2="600" y2="180" />
          <line x1="0" y1="240" x2="600" y2="240" />
          <line x1="120" y1="0" x2="120" y2="320" />
          <line x1="240" y1="0" x2="240" y2="320" />
          <line x1="360" y1="0" x2="360" y2="320" />
          <line x1="480" y1="0" x2="480" y2="320" />
        </g>
        {/* Ground plane */}
        <rect x="30" y="270" width="540" height="14" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
        {/* Main Office Tower */}
        <rect x="170" y="45" width="260" height="225" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />
        {/* Low-E Curtain Wall Glass Grid */}
        {[65, 105, 145, 185, 225].map((y, idx) => (
          <g key={y}>
            <rect
              x="186"
              y={y}
              width="228"
              height="28"
              fill={idx < 4 ? '#0284C7' : '#0369A1'}
              fillOpacity={idx === 2 ? '0.45' : '0.28'}
              stroke="#38BDF8"
              strokeWidth="1"
            />
            <line x1="243" y1={y} x2="243" y2={y + 28} stroke="#38BDF8" strokeWidth="1" />
            <line x1="300" y1={y} x2="300" y2={y + 28} stroke="#38BDF8" strokeWidth="1" />
            <line x1="357" y1={y} x2="357" y2={y + 28} stroke="#38BDF8" strokeWidth="1" />
          </g>
        ))}
        {/* Structural reinforcement highlight on level 3-4 */}
        <rect
          x="166"
          y="138"
          width="268"
          height="42"
          fill="none"
          stroke="#F59E0B"
          strokeWidth="2"
          strokeDasharray="6 3"
        />
        <text x="445" y="162" fill="#FBBF24" fontSize="11" fontFamily="IBM Plex Mono, monospace">
          L3-L4 STRUKTUR 90%
        </text>
        <text x="45" y="32" fill="#E2E8F0" fontSize="12" fontWeight="600" fontFamily="IBM Plex Mono, monospace">
          BIM ELEVATION · RENOVASI KANTOR PUSAT [DEMO]
        </text>
      </svg>
    );
  }

  if (type === 'SVG_HOUSE_BUILDING') {
    return (
      <svg
        viewBox="0 0 600 320"
        className={`${className} bg-slate-900 select-none`}
        role="img"
        aria-label="Visualisasi Arsitektur Pembangunan Rumah Tinggal"
      >
        <rect width="600" height="320" fill="#0B1E3D" />
        <g stroke="#1E3A5F" strokeWidth="1">
          <line x1="0" y1="80" x2="600" y2="80" />
          <line x1="0" y1="160" x2="600" y2="160" />
          <line x1="0" y1="240" x2="600" y2="240" />
          <line x1="150" y1="0" x2="150" y2="320" />
          <line x1="300" y1="0" x2="300" y2="320" />
          <line x1="450" y1="0" x2="450" y2="320" />
        </g>
        {/* Ground */}
        <rect x="60" y="262" width="480" height="12" fill="#1E293B" stroke="#10B981" strokeWidth="1.5" />
        {/* 2-Storey Tropical Modern House */}
        <rect x="150" y="165" width="300" height="97" fill="#0F172A" stroke="#34D399" strokeWidth="2" />
        <rect x="180" y="95" width="240" height="70" fill="#1E293B" stroke="#34D399" strokeWidth="2" />
        {/* Pitched Roof */}
        <polygon points="155,95 300,42 445,95" fill="#064E3B" stroke="#10B981" strokeWidth="2" />
        {/* Windows & Balcony */}
        <rect x="205" y="112" width="75" height="40" fill="#0284C7" fillOpacity="0.35" stroke="#38BDF8" />
        <rect x="315" y="112" width="75" height="40" fill="#0284C7" fillOpacity="0.35" stroke="#38BDF8" />
        <rect x="180" y="190" width="90" height="72" fill="#0284C7" fillOpacity="0.25" stroke="#38BDF8" />
        <rect x="310" y="190" width="110" height="55" fill="#0284C7" fillOpacity="0.25" stroke="#38BDF8" />
        <text x="45" y="32" fill="#A7F3D0" fontSize="12" fontWeight="600" fontFamily="IBM Plex Mono, monospace">
          AS-BUILT 100% SELESAI · RUMAH TINGGAL 2 LANTAI [DEMO]
        </text>
      </svg>
    );
  }

  // Default: SVG_AULA_BUILDING (Pembangunan Gedung Aula)
  return (
    <svg
      viewBox="0 0 600 320"
      className={`${className} bg-[#0B1E3D] select-none`}
      role="img"
      aria-label="Visualisasi Arsitektur Pembangunan Gedung Aula"
    >
      <defs>
        <linearGradient id="aulaBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#071326" />
          <stop offset="100%" stopColor="#122B54" />
        </linearGradient>
      </defs>
      <rect width="600" height="320" fill="url(#aulaBg)" />
      {/* CAD Grid */}
      <g stroke="#1E3A5F" strokeWidth="0.8">
        <line x1="0" y1="64" x2="600" y2="64" />
        <line x1="0" y1="128" x2="600" y2="128" />
        <line x1="0" y1="192" x2="600" y2="192" />
        <line x1="0" y1="256" x2="600" y2="256" />
        <line x1="100" y1="0" x2="100" y2="320" />
        <line x1="200" y1="0" x2="200" y2="320" />
        <line x1="300" y1="0" x2="300" y2="320" />
        <line x1="400" y1="0" x2="400" y2="320" />
        <line x1="500" y1="0" x2="500" y2="320" />
      </g>
      {/* Foundation footings & tie beam (100% complete) */}
      <rect x="65" y="255" width="470" height="16" fill="#065F46" stroke="#10B981" strokeWidth="1.8" />
      {[85, 165, 245, 355, 435, 515].map((x) => (
        <rect
          key={x}
          x={x - 16}
          y="271"
          width="32"
          height="14"
          fill="#047857"
          stroke="#34D399"
          strokeWidth="1.2"
        />
      ))}
      {/* Main Structural Steel WF Columns (100% complete) */}
      {[85, 165, 245, 355, 435, 515].map((x) => (
        <rect
          key={x}
          x={x - 6}
          y="118"
          width="12"
          height="137"
          fill="#0284C7"
          stroke="#38BDF8"
          strokeWidth="1.5"
        />
      ))}
      {/* Acoustic Wall Panels (20% complete on left bay) */}
      <rect
        x="92"
        y="135"
        width="146"
        height="120"
        fill="#D97706"
        fillOpacity="0.28"
        stroke="#F59E0B"
        strokeWidth="1.5"
      />
      {/* Wide-Span Space Truss Roof Frame */}
      <polygon
        points="60,118 300,52 540,118"
        fill="#0EA5E9"
        fillOpacity="0.16"
        stroke="#38BDF8"
        strokeWidth="2"
      />
      <polyline
        points="85,118 165,90 245,118 300,52 355,118 435,90 515,118"
        fill="none"
        stroke="#7DD3FC"
        strokeWidth="1.5"
      />
      {/* Dimension Callouts */}
      <line x1="65" y1="298" x2="535" y2="298" stroke="#94A3B8" strokeWidth="1" />
      <text x="235" y="312" fill="#CBD5E1" fontSize="11" fontFamily="IBM Plex Mono, monospace">
        BENTANG STRUKTUR 24.0 M · PROGRES 60%
      </text>
      <text x="35" y="28" fill="#F8FAFC" fontSize="12" fontWeight="600" fontFamily="IBM Plex Mono, monospace">
        BIM SECTION · PEMBANGUNAN GEDUNG AULA [DEMO]
      </text>
      <text x="35" y="46" fill="#38BDF8" fontSize="11" fontFamily="IBM Plex Mono, monospace">
        Pondasi 100% · Struktur WF 100% · Dinding & Atap 20%
      </text>
    </svg>
  );
};

export const EvidencePreviewGraphic: React.FC<{
  previewType: string;
  fileName: string;
  stageName: string;
}> = ({ previewType, fileName, stageName }) => {
  if (previewType === 'SVG_EVIDENCE_PDF') {
    return (
      <div className="w-full h-44 bg-slate-100 border border-slate-200 rounded-md p-4 flex flex-col justify-between text-left">
        <div className="flex items-start justify-between border-b border-slate-300 pb-2">
          <div>
            <div className="text-[11px] font-mono font-semibold text-slate-800">
              DOKUMEN TEKNIS & BERITA ACARA [DEMO]
            </div>
            <div className="text-xs text-slate-600 truncate max-w-[230px]">{fileName}</div>
          </div>
          <span className="text-xs font-mono font-semibold text-red-700">PDF · SIGNED</span>
        </div>
        <div className="space-y-1.5 my-2">
          <div className="h-2 bg-slate-300 rounded w-11/12" />
          <div className="h-2 bg-slate-300 rounded w-9/12" />
          <div className="h-2 bg-slate-300 rounded w-10/12" />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 pt-1 border-t border-slate-200">
          <span>Tahap: {stageName}</span>
          <span className="text-emerald-700 font-semibold">TERVALIDASI</span>
        </div>
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 400 190"
      className="w-full h-44 bg-slate-900 rounded-md select-none"
      role="img"
      aria-label={`Preview Bukti ${fileName}`}
    >
      <rect width="400" height="190" fill="#0F172A" />
      <g stroke="#1E293B" strokeWidth="1">
        <line x1="0" y1="45" x2="400" y2="45" />
        <line x1="0" y1="95" x2="400" y2="95" />
        <line x1="0" y1="145" x2="400" y2="145" />
        <line x1="100" y1="0" x2="100" y2="190" />
        <line x1="200" y1="0" x2="200" y2="190" />
        <line x1="300" y1="0" x2="300" y2="190" />
      </g>
      {previewType === 'SVG_EVIDENCE_FOUNDATION' ? (
        <g>
          <rect x="50" y="120" width="300" height="35" fill="#065F46" stroke="#34D399" strokeWidth="2" />
          <line x1="70" y1="130" x2="330" y2="130" stroke="#A7F3D0" strokeWidth="1.5" strokeDasharray="8 4" />
          <line x1="70" y1="145" x2="330" y2="145" stroke="#A7F3D0" strokeWidth="1.5" strokeDasharray="8 4" />
          <text x="20" y="26" fill="#6EE7B7" fontSize="11" fontFamily="IBM Plex Mono, monospace">
            FOTO INSPEKSI LAPANGAN · PONDASI K-350 [DEMO]
          </text>
        </g>
      ) : (
        <g>
          <rect x="70" y="45" width="16" height="115" fill="#0284C7" stroke="#38BDF8" strokeWidth="1.5" />
          <rect x="192" y="45" width="16" height="115" fill="#0284C7" stroke="#38BDF8" strokeWidth="1.5" />
          <rect x="314" y="45" width="16" height="115" fill="#0284C7" stroke="#38BDF8" strokeWidth="1.5" />
          <polygon points="65,45 200,18 335,45" fill="none" stroke="#38BDF8" strokeWidth="2" />
          <text x="20" y="26" fill="#7DD3FC" fontSize="11" fontFamily="IBM Plex Mono, monospace">
            DOKUMENTASI STRUKTUR & FASAD [DEMO]
          </text>
        </g>
      )}
      <text x="20" y="176" fill="#94A3B8" fontSize="10" fontFamily="IBM Plex Mono, monospace">
        {fileName} · GPS VERIFIED
      </text>
    </svg>
  );
};
