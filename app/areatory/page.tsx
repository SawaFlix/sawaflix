"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AreaToryHero from "@/components/AreaTory/AreaToryHero";
import StoryGrid from "@/components/AreaTory/StoryGrid";
import { Send, Bell, MessageSquare } from "lucide-react";
import { CommentSidebarProvider } from '@/components/AreaTory/CommentSidebarContext';

export default function AreaToryPage() {
  return (
    <main className="min-h-screen bg-[#0B0E14] text-white overflow-hidden">
      <Navbar />
      
      <AreaToryHero />

      {/* Community Quick Updates / Announcements */}
      <section className="py-20 border-y border-white/5 bg-black/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-between gap-12">
            <div className="flex items-center gap-6">
               <div className="w-14 h-14 bg-red-600/10 rounded-2xl flex items-center justify-center border border-red-600/20">
                  <Bell className="w-6 h-6 text-red-600" />
               </div>
               <div>
                  <h4 className="text-white font-black text-lg">Live Updates</h4>
                  <p className="text-gray-500 text-sm font-medium">Get real-time announcements from the Sawaflix team.</p>
               </div>
            </div>

            <div className="flex-1 max-w-xl">
               <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center gap-4">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  <p className="text-gray-300 text-sm font-medium">
                    <span className="text-white font-bold">New:</span> Sawaflix app for Android is now in beta. Check your dashboard for access!
                  </p>
                  <button className="ml-auto text-xs font-black uppercase tracking-widest hover:text-red-600 transition-colors">
                    Join Beta
                  </button>
               </div>
            </div>

            <div className="flex items-center gap-3">
               <button className="p-3 bg-white/5 rounded-full border border-white/10 hover:bg-white hover:text-black transition-all">
                  <MessageSquare className="w-5 h-5" />
               </button>
               <button className="p-3 bg-white/5 rounded-full border border-white/10 hover:bg-white hover:text-black transition-all">
                  <Send className="w-5 h-5" />
               </button>
            </div>
          </div>
        </div>
      </section>

      <StoryGrid />

      {/* Join the Community CTA */}
      <section className="py-24 relative overflow-hidden">
         <div className="absolute inset-0 bg-red-600/10 blur-[150px] rounded-full -top-1/2 -left-1/4" />
         <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <div>
               <h2 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tighter">
                  TELL YOUR <br />
                  <span className="text-red-600">STORY.</span>
               </h2>
               <p className="text-gray-400 text-lg md:text-xl font-medium mb-12 max-w-2xl mx-auto leading-relaxed">
                  Join a community of storytellers, artists, and culture preserves. 
                  Share your perspective and become part of the Sawaflix legacy.
               </p>
               <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button className="px-10 py-5 bg-red-600 text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-red-600/30 hover:scale-105 active:scale-95 transition-all">
                     BECOME A CREATOR
                  </button>
                  <button className="px-10 py-5 bg-white/5 border border-white/10 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all">
                     JOIN DISCORD
                  </button>
               </div>
            </div>
         </div>
      </section>
      
      <Footer />
    </main>
  );
}
