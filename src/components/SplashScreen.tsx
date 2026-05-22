"use client";

import React from "react";
import Image from "next/image";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 select-none overflow-hidden">
      {/* Styles for premium animations */}
      <style jsx global>{`
        @keyframes floatLogo {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-12px) rotate(2deg);
          }
        }
        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.4;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
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
        @keyframes loadingDot {
          0%, 100% {
            opacity: 0.2;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: translateY(300px) scale(0.6);
          }
          60% {
            opacity: 1;
            transform: translateY(-20px) scale(1.04);
          }
          80% {
            transform: translateY(10px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .anim-bounce-entry {
          animation: bounceIn 1.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }
        .anim-float {
          animation: floatLogo 4s ease-in-out infinite;
          animation-delay: 1.3s; /* Start floating after bounce entry completes */
        }
        .anim-glow {
          animation: pulseGlow 3s ease-in-out infinite;
        }
        .anim-ring {
          animation: rotateRing 8s linear infinite;
        }
        .anim-ring-reverse {
          animation: rotateRing 12s linear infinite reverse;
        }
        .dot-1 {
          animation: loadingDot 1.4s infinite;
          animation-delay: 0s;
        }
        .dot-2 {
          animation: loadingDot 1.4s infinite;
          animation-delay: 0.2s;
        }
        .dot-3 {
          animation: loadingDot 1.4s infinite;
          animation-delay: 0.4s;
        }
      `}</style>

      {/* Decorative background grid elements */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative flex flex-col items-center max-w-sm px-8 text-center anim-bounce-entry">
        
        {/* Glow behind the logo */}
        <div className="absolute top-1/4 -translate-y-1/2 w-64 h-64 bg-green-300 rounded-full mix-blend-multiply filter blur-3xl anim-glow opacity-50" />
        <div className="absolute top-1/4 -translate-y-1/2 w-64 h-64 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl anim-glow opacity-40 [animation-delay:1.5s]" />

        {/* Logo Container */}
        <div className="relative w-36 h-36 flex items-center justify-center mb-8">
          
          {/* Animated Ring 1 */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-green-200 anim-ring" />
          
          {/* Animated Ring 2 (Outer) */}
          <div className="absolute -inset-4 rounded-full border border-green-100/50 anim-ring-reverse" />
          
          {/* Glowing Shadow */}
          <div className="absolute w-24 h-24 rounded-full bg-green-500/20 filter blur-xl" />

          {/* Logo Asset */}
          <div className="relative w-28 h-28 rounded-3xl bg-white shadow-2xl p-2 border border-green-50/50 flex items-center justify-center anim-float overflow-hidden">
            <Image
              src="/favico&PWAimg.png"
              alt="Frugalin Logo"
              width={96}
              height={96}
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Text Area */}
        <div className="relative z-10 flex flex-col items-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">
            frugalin<span className="text-green-600">.aja</span>
          </h1>
          
          {/* Subtitle / Loading Indicator */}
          <div className="flex items-center gap-1.5 mt-2 bg-white/70 backdrop-blur-md px-4 py-2 rounded-full border border-green-100/30 shadow-sm">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Menyelaraskan dompet digital
            </span>
            <span className="flex items-center text-xs font-bold text-green-600">
              <span className="dot-1 font-mono">.</span>
              <span className="dot-2 font-mono">.</span>
              <span className="dot-3 font-mono">.</span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
