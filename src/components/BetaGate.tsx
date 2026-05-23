import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Leaf, Droplets, Lock, ArrowRight, Eye, EyeOff, Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface BetaGateProps {
  onUnlock: () => void;
}

export default function BetaGate({ onUnlock }: BetaGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<'input' | 'unlocking'>('input');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [shouldShake, setShouldShake] = useState(false);
  const [loadingText, setLoadingText] = useState('Gartenerde vorbereiten...');

  useEffect(() => {
    if (phase === 'unlocking') {
      const texts = [
        'Samen aussäen...',
        'Wurzeln schlagen lassen...',
        'Erste Sprösslinge pflegen...',
        'Blütenblätter entfalten...',
        'Frisches Gießwasser temperieren...',
        'Tropfschläuche kalibrieren...',
        'Dein grünes Paradies öffnet sich...'
      ];

      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          const next = prev + Math.floor(Math.random() * 8) + 3;
          if (next >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              onUnlock();
            }, 400);
            return 100;
          }
          const textIdx = Math.min(Math.floor((next / 100) * texts.length), texts.length - 1);
          setLoadingText(texts[textIdx]);
          return next;
        });
      }, 60);

      return () => clearInterval(interval);
    }
  }, [phase, onUnlock]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() === 'admin') {
      setShouldShake(true);
      setError(false);
      setTimeout(() => {
        setShouldShake(false);
        setPhase('unlocking');
      }, 505);
    } else {
      setError(true);
      setShouldShake(true);
      setPassword('');
      
      // Gentle water-drop-like plop sound on mistake instead of harsh alarm
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } catch (e) {
        // ignore audio failure
      }
      
      setTimeout(() => setShouldShake(false), 500);
    }
  };

  const logoAnimationVariants = {
    idle: {
      y: [0, -4, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    },
    shake: {
      x: [0, -8, 8, -6, 6, -4, 4, -2, 2, 0],
      rotate: [0, -2, 2, -1.5, 1.5, -1, 1, 0],
      transition: {
        duration: 0.5,
        ease: 'easeInOut'
      }
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-[#f2f8f4] to-[#e4efe7] text-slate-800 flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans selection:bg-emerald-200 selection:text-emerald-900">
      {/* Decorative botanical warm leaf orbs / gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-100/60 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-100/50 blur-3xl pointer-events-none" />

      {/* Floating Leaves or Organic Shapes */}
      <div className="absolute top-1/4 right-1/4 opacity-10 animate-pulse pointer-events-none">
        <Leaf className="w-16 h-16 text-emerald-600 rotate-45 transform" />
      </div>
      <div className="absolute bottom-1/3 left-10 opacity-5 pointer-events-none">
        <Leaf className="w-32 h-32 text-emerald-700 -rotate-12 transform" />
      </div>

      <div className="h-6 sm:h-10" />

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto z-10 flex flex-col items-center">
        {/* Logo and Greeting */}
        <motion.div
          animate={shouldShake ? 'shake' : 'idle'}
          variants={logoAnimationVariants}
          className="flex flex-col items-center gap-3 select-none text-center cursor-default shrink-0"
        >
          <div className="w-20 h-20 rounded-full bg-[#d0ebd8] flex items-center justify-center shadow-md relative group transition-all duration-300">
            <div className="absolute inset-0 rounded-full bg-emerald-100 animate-pulse -z-10" />
            <Leaf className="w-10 h-10 text-emerald-600" />
          </div>
          <div className="flex flex-col justify-center items-center">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-none">
              Garten<span className="text-emerald-600">paradies</span>
            </h1>
            <p className="text-xs font-semibold text-emerald-700 mt-2 bg-emerald-100/70 border border-emerald-200 px-3 py-1 rounded-full whitespace-nowrap">
              ✿ Interaktive Garten- und Bewässerungsplanung ✿
            </p>
          </div>
        </motion.div>

        <div className="h-8 sm:h-10" />

        <AnimatePresence mode="wait">
          {phase === 'input' ? (
            <motion.div
              key="password-pane"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="w-full bg-white/95 backdrop-blur-md border border-[#cde2d3] rounded-3xl p-6 sm:p-8 shadow-[0_20px_40px_rgba(40,60,50,0.06)] flex flex-col border-b-4 border-b-emerald-600"
            >
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 font-sans">Herzlich willkommen im Planer</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-sans">
                  Gib das Passwort ein, um deinen persönlichen Gartenbereich freizuschalten.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(false);
                    }}
                    placeholder="Dein Passwort (z.B. admin)..."
                    autoFocus
                    className={`w-full bg-[#f8faf8] border ${
                      error ? 'border-red-400 focus:ring-red-200' : 'border-[#cedcd2] focus:border-emerald-500 focus:ring-emerald-200'
                    } text-sm text-slate-800 placeholder-slate-400 pl-4 pr-12 py-3.5 rounded-2xl outline-none transition focus:ring-4 font-bold text-center`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition shrink-0"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 bg-red-50 border border-red-200 p-3 rounded-xl text-xs text-red-600 font-medium"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>Hoppla, das Passwort ist nicht ganz korrekt. (Hinweis: admin)</span>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={!password}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 font-extrabold text-white rounded-2xl transition duration-200 flex items-center justify-center gap-2 text-sm shadow-md shadow-emerald-700/10 cursor-pointer"
                >
                  <span>Garten betreten</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="loading-pane"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full bg-white/95 backdrop-blur-md border border-[#cde2d3] rounded-3xl p-6 sm:p-8 shadow-[0_20px_40px_rgba(40,60,50,0.06)] flex flex-col border-b-4 border-b-emerald-600"
            >
              <div className="flex flex-col items-center mb-6">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                  <Leaf className="w-5 h-5 text-emerald-600 animate-bounce" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Dein Garten gedeiht</h4>
                <p className="text-xs text-slate-400 mt-1">Einen kleinen Augenblick bitte...</p>
              </div>

              {/* Garden-Themed progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-[#cedcd2] shadow-inner mb-3">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                  style={{ width: `${loadingProgress}%` }}
                  transition={{ ease: 'easeOut' }}
                />
              </div>

              <div className="text-center min-h-[1.5rem] flex items-center justify-center mt-2">
                <span className="text-xs text-emerald-700 font-bold font-sans animate-pulse">
                  {loadingText}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full text-center z-10 shrink-0 select-none">
        <p className="text-[10px] uppercase tracking-widest text-[#728f7b] font-mono">
          ✿ GARTENPARADIES BETASEITE ✿
        </p>
      </div>
    </div>
  );
}
