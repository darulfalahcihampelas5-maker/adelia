import { motion } from 'motion/react';

export default function RefreshLoadingScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25, ease: 'easeOut' } }}
      className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#fff5f7] via-white to-rose-50 flex flex-col items-center justify-center p-6 select-none overflow-hidden"
    >
      {/* Soft glowing pink backdrop */}
      <motion.div
        animate={{ scale: [0.95, 1.08, 0.95], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-72 h-72 rounded-full bg-[#F06C84]/15 blur-3xl pointer-events-none"
      />

      {/* Animated Cute Pink Cartoon Animal Mascot (Sacil Smart Mascot) */}
      <div className="relative flex flex-col items-center">
        {/* Floating Sparkles */}
        <motion.div
          animate={{ y: [-4, 4, -4], opacity: [0.5, 1, 0.5], scale: [0.9, 1.15, 0.9] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-3 -left-6 text-[#F06C84]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z" />
          </svg>
        </motion.div>

        <motion.div
          animate={{ y: [3, -5, 3], opacity: [0.5, 1, 0.5], scale: [1.1, 0.85, 1.1] }}
          transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          className="absolute -top-1 -right-7 text-rose-400"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z" />
          </svg>
        </motion.div>

        {/* Bouncing Mascot Character */}
        <motion.div
          animate={{
            y: [0, -14, 0, -8, 0],
            rotate: [0, -3, 0, 3, 0],
            scale: [1, 1.03, 0.98, 1.02, 1],
          }}
          transition={{
            duration: 1.0,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="relative z-10"
        >
          <svg
            width="148"
            height="148"
            viewBox="0 0 160 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Maskot Sacil Smart"
          >
            {/* Left Ear (wiggling) */}
            <motion.g
              animate={{ rotate: [-6, 8, -6] }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformOrigin: '54px 52px' }}
            >
              <ellipse cx="48" cy="34" rx="15" ry="28" transform="rotate(-14 48 34)" fill="#F06C84" stroke="#d84863" strokeWidth="3" />
              <ellipse cx="49" cy="36" rx="8" ry="18" transform="rotate(-14 49 36)" fill="#ffd1dc" />
            </motion.g>

            {/* Right Ear (wiggling) */}
            <motion.g
              animate={{ rotate: [6, -8, 6] }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformOrigin: '106px 52px' }}
            >
              <ellipse cx="112" cy="34" rx="15" ry="28" transform="rotate(14 112 34)" fill="#F06C84" stroke="#d84863" strokeWidth="3" />
              <ellipse cx="111" cy="36" rx="8" ry="18" transform="rotate(14 111 36)" fill="#ffd1dc" />
            </motion.g>

            {/* Cute Little Tail */}
            <motion.circle
              cx="124"
              cy="122"
              r="11"
              fill="#ffb6c7"
              stroke="#d84863"
              strokeWidth="2.5"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />

            {/* Chubby Pink Body */}
            <ellipse cx="80" cy="116" rx="34" ry="28" fill="#F06C84" stroke="#d84863" strokeWidth="3" />
            {/* Cream/Light Pink Belly */}
            <ellipse cx="80" cy="120" rx="21" ry="18" fill="#ffe6ec" />
            {/* Heart Emblem on Belly */}
            <path
              d="M80 127C80 127 71 121.5 71 116.5C71 114 73 112 75.5 112C77.3 112 79 113.2 80 114.6C81 113.2 82.7 112 84.5 112C87 112 89 114 89 116.5C89 121.5 80 127 80 127Z"
              fill="#F06C84"
            />

            {/* Left Waving Paw */}
            <motion.g
              animate={{ rotate: [-14, 18, -14] }}
              transition={{ duration: 0.55, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformOrigin: '50px 104px' }}
            >
              <ellipse cx="42" cy="108" rx="10" ry="15" transform="rotate(35 42 108)" fill="#ff8ea3" stroke="#d84863" strokeWidth="3" />
            </motion.g>

            {/* Right Waving Paw */}
            <motion.g
              animate={{ rotate: [14, -18, 14] }}
              transition={{ duration: 0.55, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformOrigin: '110px 104px' }}
            >
              <ellipse cx="118" cy="108" rx="10" ry="15" transform="rotate(-35 118 108)" fill="#ff8ea3" stroke="#d84863" strokeWidth="3" />
            </motion.g>

            {/* Feet */}
            <ellipse cx="64" cy="142" rx="12" ry="7" fill="#ff8ea3" stroke="#d84863" strokeWidth="3" />
            <ellipse cx="96" cy="142" rx="12" ry="7" fill="#ff8ea3" stroke="#d84863" strokeWidth="3" />

            {/* Round Cute Head */}
            <ellipse cx="80" cy="74" rx="42" ry="35" fill="#ff8ea3" stroke="#d84863" strokeWidth="3" />

            {/* Forehead Smart Star/Ribbon */}
            <path d="M80 42L83 48L89 49L84.5 53.5L85.5 59.5L80 56.5L74.5 59.5L75.5 53.5L71 49L77 48L80 42Z" fill="#fff0f3" stroke="#d84863" strokeWidth="1.5" />

            {/* Rosy Cheeks */}
            <ellipse cx="52" cy="82" rx="7.5" ry="4.5" fill="#ff5c7c" opacity="0.55" />
            <ellipse cx="108" cy="82" rx="7.5" ry="4.5" fill="#ff5c7c" opacity="0.55" />

            {/* Big Sparkling Eyes */}
            <motion.g
              animate={{ scaleY: [1, 1, 0.15, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, times: [0, 0.85, 0.92, 1] }}
              style={{ transformOrigin: '80px 72px' }}
            >
              <circle cx="62" cy="72" r="7" fill="#2b1920" />
              <circle cx="60" cy="69.5" r="2.6" fill="#ffffff" />
              <circle cx="64.5" cy="74" r="1.2" fill="#ffffff" />

              <circle cx="98" cy="72" r="7" fill="#2b1920" />
              <circle cx="96" cy="69.5" r="2.6" fill="#ffffff" />
              <circle cx="100.5" cy="74" r="1.2" fill="#ffffff" />
            </motion.g>

            {/* Cute Nose & Happy Smile */}
            <ellipse cx="80" cy="79" rx="3.5" ry="2.5" fill="#d84863" />
            <path d="M74 84C76 88 80 87 80 83.5C80 87 84 88 86 84" stroke="#6d2134" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>

        {/* Ground Shadow synced with bounce */}
        <motion.div
          animate={{ scaleX: [1, 0.72, 1, 0.85, 1], opacity: [0.35, 0.18, 0.35, 0.25, 0.35] }}
          transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
          className="w-24 h-3 bg-[#F06C84]/30 rounded-full blur-[2px] -mt-2 mb-5"
        />

        {/* Text: Memuat Halaman (Modern & Profesional) */}
        <div className="flex flex-col items-center gap-3 text-center max-w-xs w-full">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#F06C84]">
              SACIL SMART
            </span>
          </div>

          <h2 className="text-2xl sm:text-[26px] font-extrabold tracking-tight bg-gradient-to-r from-slate-800 via-[#d84863] to-[#F06C84] bg-clip-text text-transparent">
            Memuat Halaman
          </h2>

          {/* Smooth 1s Progress Bar */}
          <div className="w-44 h-1.5 bg-rose-100 rounded-full overflow-hidden shadow-inner">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 0.95, ease: 'easeInOut' }}
              className="h-full rounded-full bg-gradient-to-r from-[#F06C84] to-[#d84863]"
            />
          </div>

          <p className="text-xs font-medium text-slate-500 tracking-wide">
            Menyiapkan data dan tampilan terbaru...
          </p>
        </div>
      </div>
    </motion.div>
  );
}
