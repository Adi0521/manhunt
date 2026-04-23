"use client"

import * as React from 'react';
import { useState, useEffect } from 'react';
// import './index.css'

import { Button } from "@/components/ui/button"

import supabase, { hasSupabaseEnv } from "../utils/supabase";

import Image from 'next/image';

import type { Session } from '@supabase/supabase-js'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import evilSpongebobGif from '../evil-spongebob-ezgif.com-video-to-gif-converter.gif';

export default function AuthPage() {
  
  const [session, setSession] = useState<Session | null>(null)

  const sb = supabase;

  useEffect(() => {
    if (!hasSupabaseEnv || !sb) return;

    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])


  if (!hasSupabaseEnv || !sb) {
    return (
      <div className="min-h-screen bg-stone-300 dark:bg-neutral-900 text-slate-900 dark:text-slate-100">
        <div className="w-full bg-slate-800 dark:bg-[rgb(20,77,128)] text-white" style={{ height: "40px" }}>
          <h1 className="absolute l-0 m-2">Manhunt</h1>
        </div>
        <div className="max-w-xl mx-auto mt-32 p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700">
          <h2 className="text-xl font-semibold">Supabase not configured</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to use auth.
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className='text-center ml-1/2 bg-stone-300 dark:bg-neutral-900'>

        <div className="w-full bg-slate-800 dark:bg-[rgb(20,77,128)] text-white" style={{ height: "40px" }}>
          <h1 className="absolute l-0 m-2">Manhunt</h1>
        </div>
        <div className="w-1/2 ml-[25%] mt-32">
          <Auth
            supabaseClient={sb}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#1e293b',
                    brandAccent: '#1e293b',
                    brandButtonText: 'white',
                    inputBorder: '#1e293b',
                    inputBackground: 'aliceblue',
                  },
                },
              }, 
            }}
            providers={[]}
          />
        </div>
      </div>
    )
  } else {
    // console.log(session);
    // location.href = "/";

    return (
      <div className='text-center ml-1/2 bg-stone-300 dark:bg-neutral-900'>

        <div className="w-full bg-slate-800 dark:bg-[rgb(20,77,128)] text-white" style={{ height: "40px" }}>
          <h1 className="absolute l-0 m-2">Manhunt • {session?.user.email}</h1>
        </div>
        
        <div className="flex flex-col items-center space-y-4 mt-8">
            <div className="p-8 m-4 rounded shadow flex flex-col items-center space-y-4 w-full max-w-xl">
            <Button className="bg-slate-400 text-center">Hello, {session.user.email}</Button>
            
            <Image
              src={evilSpongebobGif}
              alt="Evil Spongebob"
              width={300}
              height={200}
              style={{ display: "inline-block" }}
            />

            <div className="flex flex-row space-x-4 mt-1">
              <Button className="bg-blue-400" onClick={() => { window.location.href = "/"; }}>Go to Manhunt</Button>
              <Button onClick={() => { window.location.href = "/admin"; }}>Admin</Button>
              <Button className='bg-green-400' onClick={async () => {
              const { error } = await sb.auth.signOut()
              if (error) console.log('Error logging out:', error.message)
              else console.log('Logged out successfully')
              }}>Logout</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}