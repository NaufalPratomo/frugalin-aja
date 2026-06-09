"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 select-none overflow-hidden text-slate-800">
      {/* Premium Styles */}
      <style jsx global>{`
        @keyframes floatLogo {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-10px) rotate(1deg);
          }
        }
        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.4;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
        @keyframes rotateRing {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes moveBlob {
          0%, 100% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.95);
          }
        }
        @keyframes shimmerSweep {
          0% {
            left: -150%;
          }
          50%, 100% {
            left: 150%;
          }
        }
        .anim-shimmer {
          position: relative;
          overflow: hidden;
        }
        .anim-shimmer::after {
          content: "";
          position: absolute;
          top: 0;
          height: 100%;
          width: 50%;
          background: linear-gradient(
            to right,
            transparent,
            rgba(16, 185, 129, 0.1),
            transparent
          );
          transform: skewX(-25deg);
          left: -150%;
          animation: shimmerSweep 3s infinite;
        }
        .anim-float {
          animation: floatLogo 4s ease-in-out infinite;
        }
        .anim-glow {
          animation: pulseGlow 4s ease-in-out infinite;
        }
        .anim-ring {
          animation: rotateRing 10s linear infinite;
        }
        .anim-ring-reverse {
          animation: rotateRing 14s linear infinite reverse;
        }
        .anim-blob-1 {
          animation: moveBlob 12s infinite alternate;
        }
        .anim-blob-2 {
          animation: moveBlob 16s infinite alternate-reverse;
        }
      `}</style>

      {/* Moving Ambient Mesh Blobs in Background */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-emerald-100/60 rounded-full filter blur-[100px] anim-blob-1 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-100/50 rounded-full filter blur-[120px] anim-blob-2 pointer-events-none" />

      {/* Decorative Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.015)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Main Content Card */}
      <div className="relative flex flex-col items-center max-w-sm px-8 text-center z-10">
        
        {/* Glow backdrop behind the logo */}
        <div className="absolute w-48 h-48 bg-emerald-100 rounded-full filter blur-[40px] anim-glow" />

        {/* Logo Container */}
        <div className="relative w-36 h-36 flex items-center justify-center mb-8">
          {/* Animated Ring 1 */}
          <div className="absolute inset-0 rounded-full border border-dashed border-emerald-500/20 anim-ring" />
          {/* Animated Ring 2 (Outer) */}
          <div className="absolute -inset-4 rounded-full border border-emerald-500/10 anim-ring-reverse" />
          
          {/* Logo Box */}
          <div className="relative w-28 h-28 rounded-3xl bg-white border border-emerald-100 flex items-center justify-center anim-float shadow-[0_10px_30px_rgba(16,185,129,0.08)] overflow-hidden anim-shimmer">
            <Image
              src="/favico&PWAimg.png"
              alt="Frugalin Logo"
              width={96}
              height={96}
              className="object-contain filter drop-shadow-[0_4px_6px_rgba(16,185,129,0.1)]"
              priority
            />
          </div>
        </div>

        {/* Text Area */}
        <div className="space-y-4">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            frugalin<span className="text-emerald-500">.aja</span>
          </h1>
          
          {/* Subtitle / Loading State */}
          <div className="flex flex-col items-center gap-2">
            
            {/* Glowing Progress Line */}
            <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden mt-1 relative">
              <div 
                style={{ width: `${progress}%` }} 
                className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
