import { motion } from 'motion/react';

export default function SplashScreen() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        duration: 1, 
        ease: "easeOut",
        staggerChildren: 0.6 
      }
    },
    exit: { 
      opacity: 0,
      scale: 1.05,
      filter: "blur(10px)",
      transition: { duration: 0.8, ease: "easeInOut" }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 1, ease: [0.25, 0.1, 0.25, 1] } 
    }
  };

  const elegantTitleVariants = {
    hidden: { opacity: 0, y: 40, filter: "blur(10px)", scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      filter: "blur(0px)",
      scale: 1,
      transition: { 
        duration: 1.8, 
        ease: [0.16, 1, 0.3, 1]
      } 
    }
  };

  const subtitleVariants = {
    hidden: { opacity: 0, y: 20, filter: "blur(5px)" },
    visible: { 
      opacity: 1, 
      y: 0, 
      filter: "blur(0px)",
      transition: { 
        duration: 1.2, 
        ease: [0.16, 1, 0.3, 1], 
        delay: 0.6 
      } 
    }
  };
  
  const pulseVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: [0.1, 0.4, 0.1], 
      scale: [0.8, 1.2, 0.8],
      transition: { 
        duration: 4, 
        ease: "easeInOut",
        repeat: Infinity,
      }
    }
  };

  return (
    <motion.div
      variants={containerVariants as any}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-0 bg-[#F06C84] flex flex-col items-center justify-center text-white p-6 text-center z-50 overflow-hidden"
    >
      {/* Subtle background glow */}
      <motion.div 
        variants={pulseVariants as any}
        className="absolute w-[40rem] h-[40rem] bg-white/10 rounded-full blur-3xl -z-10"
      />

      <div className="flex flex-col items-center relative z-10 w-full max-w-3xl">
        <div className="flex flex-col items-center w-full mb-12 relative">
          <div className="absolute inset-0 bg-white/5 rounded-full blur-3xl scale-[2] -z-10 h-40"></div>
          
          <motion.h1 
            variants={elegantTitleVariants as any}
            className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter mb-3 text-white drop-shadow-2xl"
          >
            SACIL SMART App
          </motion.h1>
          
          <motion.p 
            variants={subtitleVariants as any}
            className="text-white/90 text-xs sm:text-sm md:text-base font-medium text-center px-6 leading-relaxed max-w-2xl tracking-wide"
          >
            Sistem Akademik Cerdas dan Integritas Lokal untuk Siswa Mandiri, Aktif, Responsif, dan Terpuji
          </motion.p>
        </div>

        <motion.div variants={itemVariants as any} className="flex flex-col items-center mt-8">
          <div className="flex gap-2">
             <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }} 
                transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                className="w-2.5 h-2.5 rounded-full bg-white"
             />
             <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }} 
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                className="w-2.5 h-2.5 rounded-full bg-white"
             />
             <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }} 
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                className="w-2.5 h-2.5 rounded-full bg-white"
             />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
