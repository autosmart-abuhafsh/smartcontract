import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, RefreshCw, AlertTriangle, X, KeyRound } from 'lucide-react';
import { MfaAuthLog } from '../data/seedDatabase';

interface MfaVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  actionType: MfaAuthLog['actionType'];
  actionTitle: string;
  onVerified: (mfaToken: string) => void;
}

export const MfaVerifyModal: React.FC<MfaVerifyModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  actionType,
  actionTitle,
  onVerified,
}) => {
  const [challengeId, setChallengeId] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [demoInboxOtp, setDemoInboxOtp] = useState<string>('');
  const [deliveryChannel, setDeliveryChannel] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState<number>(300);
  const [remainingAttempts, setRemainingAttempts] = useState<number>(3);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const requestNewOtp = async () => {
    setLoading(true);
    setError('');
    setOtpInput('');
    try {
      const res = await fetch('/api/mfa/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, actionType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal meminta kode OTP.');
      } else {
        setChallengeId(data.challengeId);
        setDemoInboxOtp(data.demoInboxOtpPreview);
        setDeliveryChannel(data.deliveryChannel);
        setSecondsLeft(data.expiresInSeconds || 300);
        setRemainingAttempts(data.maxAttempts || 3);
      }
    } catch {
      setError('Gagal menghubungi server autentikasi MFA.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      requestNewOtp();
    }
  }, [isOpen, userId, actionType]);

  useEffect(() => {
    if (!isOpen || secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, secondsLeft]);

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim()) {
      setError('Masukkan 6 digit kode OTP terlebih dahulu.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, otpInput: otpInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.remainingAttempts === 'number') {
          setRemainingAttempts(data.remainingAttempts);
        }
        setError(data.error || 'Verifikasi OTP gagal.');
      } else if (data.verified && data.mfaToken) {
        onVerified(data.mfaToken);
      }
    } catch {
      setError('Kesalahan jaringan saat memverifikasi OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0B1E3D] text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="mfa-modal-title" className="text-base font-bold text-slate-900">
                Otorisasi Keamanan MFA (Multi-Factor Auth)
              </h2>
              <p className="text-xs text-slate-500">
                Tindakan Kritis: <span className="font-semibold text-slate-700">{actionTitle}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal MFA"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-700 space-y-1">
            <div>
              Penanda Tangan: <span className="font-semibold text-slate-900">{userName}</span>
            </div>
            <div>
              Kanal Pengiriman: <span className="font-mono text-slate-800">{deliveryChannel}</span>
            </div>
            <div className="flex items-center justify-between pt-1 text-slate-500 font-mono">
              <span>
                Masa Berlaku: {Math.floor(secondsLeft / 60)}:
                {String(secondsLeft % 60).padStart(2, '0')}
              </span>
              <span>Sisa Percobaan: {remainingAttempts}x</span>
            </div>
          </div>

          {demoInboxOtp && (
            <div className="bg-sky-50 border border-sky-200 rounded-md p-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-sky-900">
                  Kotak Masuk OTP Simulasi [DEMO MODE]
                </div>
                <div className="text-xs text-sky-700">
                  Kode OTP Backend Anda:{' '}
                  <span className="font-mono font-bold text-sm text-sky-950 tracking-wider">
                    {demoInboxOtp}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOtpInput(demoInboxOtp)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-sky-700 text-white rounded hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0"
              >
                Gunakan Kode OTP
              </button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2 text-xs text-red-800"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label
                htmlFor="mfa-otp-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Masukkan 6-Digit Kode OTP Backend
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="mfa-otp-input"
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Contoh: 482910"
                  className="w-full pl-9 pr-4 py-2 text-sm font-mono tracking-widest border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={requestNewOtp}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Kirim Ulang OTP
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading || remainingAttempts <= 0 || secondsLeft <= 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B1E3D] hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {loading ? 'Memverifikasi...' : 'Verifikasi & Otorisasi'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
