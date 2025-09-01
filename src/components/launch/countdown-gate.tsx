'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Rocket, Calendar } from 'lucide-react';
import Image from 'next/image';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const CountdownGate: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const calculateTimeLeft = (): TimeLeft => {
      const launchDate = process.env.NEXT_PUBLIC_LAUNCH_DATE;
      if (!launchDate) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      
      const difference = new Date(launchDate).getTime() - new Date().getTime();
      
      if (difference > 0) {
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        };
      }
      
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    };

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    // Set initial time
    setTimeLeft(calculateTimeLeft());

    return () => clearInterval(timer);
  }, []);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return dateString;
    }
  };

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  const launchDate = process.env.NEXT_PUBLIC_LAUNCH_DATE;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent-to/5 flex items-center justify-center p-4">
      {/* Grid Background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(156, 163, 175, 0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(156, 163, 175, 0.6) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      
      <div className="relative z-10 w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-accent-gradient rounded-full">
              <Image
                src="/6.png"
                alt="KOL Play Logo"
                width={48}
                height={48}
                className="h-12 w-12"
              />
            </div>
          </div>
          <div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
              <span className="block bg-accent-gradient bg-clip-text text-transparent">
                KOL Play
              </span>
              <span className="block text-2xl md:text-3xl font-semibold text-muted-foreground mt-2">
                Launching Soon
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto">
              Get ready for the next generation of social trading on Solana
            </p>
          </div>
        </div>

        {/* Countdown Timer */}
        <Card className="bg-background/80 backdrop-blur-sm border-2">
          <CardHeader className="text-center pb-4">
            <CardTitle className="flex items-center justify-center gap-3 text-2xl md:text-3xl">
              <Clock className="h-8 w-8 text-accent-from" />
              Countdown to Launch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Days', value: timeLeft.days },
                { label: 'Hours', value: timeLeft.hours },
                { label: 'Minutes', value: timeLeft.minutes },
                { label: 'Seconds', value: timeLeft.seconds },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <div className="bg-gradient-to-br from-accent-from/20 to-accent-to/20 rounded-xl p-4 mb-2">
                    <div className="text-3xl md:text-4xl font-bold text-foreground">
                      {value.toString().padStart(2, '0')}
                    </div>
                  </div>
                  <div className="text-sm md:text-base text-muted-foreground font-medium">
                    {label}
                  </div>
                </div>
              ))}
            </div>
            
            {launchDate && (
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">Launch Date</span>
                </div>
                <div className="text-sm md:text-base text-foreground">
                  {formatDate(launchDate)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features Preview */}
        <Card className="bg-background/60 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-xl font-semibold text-foreground">
                <Rocket className="h-6 w-6 text-accent-from" />
                What's Coming
              </div>
              <div className="grid md:grid-cols-3 gap-4 text-sm md:text-base">
                <div className="space-y-2">
                  <div className="font-semibold text-foreground">🤖 AI-Powered Trading</div>
                  <div className="text-muted-foreground">Machine learning predictions for better trades</div>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold text-foreground">👥 Social Copy Trading</div>
                  <div className="text-muted-foreground">Follow and copy successful KOL strategies</div>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold text-foreground">⚡ Real-time Analytics</div>
                  <div className="text-muted-foreground">Live market data and performance tracking</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Stay tuned for the official launch. Follow us on social media for updates.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CountdownGate;