import { useState, useEffect, memo } from 'react';

function DigitalClockComponent() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    }).replace(/\./g, ':');
  };

  return (
    <div className="text-5xl lg:text-7xl font-mono font-bold tracking-tight text-[#F06C84] drop-shadow-sm select-none">
      {formatTime(time)}
    </div>
  );
}

export const DigitalClock = memo(DigitalClockComponent);
