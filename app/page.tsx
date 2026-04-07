'use client'
import React, { useState, useEffect } from 'react'

const messages = ["Welcome to FreeTrust", "Trust is free here", "Earn Trust, grow together", "Built on purpose"]

export default function Home() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % 4), 4000)
    return () => clearInterval(t)
  }, [])
  return (
    <main style={{minHeight:'100vh',background:'#0a0f1e',color:'#fff',fontFamily:'system-ui',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'2rem',padding:'2rem',textAlign:'center'}}>
      <h1 style={{fontSize:'3rem',fontWeight:900}}>Free<span style={{color:'#10b981'}}>Trust</span></h1>
      <div style={{width:160,height:160,borderRadius:'50%',background:'radial-gradient(circle,#064e3b,#0a0f1e)',border:'2px solid #10b981',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 60px #10b981'}}>
        <span style={{fontSize:'3rem'}}>🤖</span>
      </div>
      <p style={{color:'#a0aec0',maxWidth:360}}>{messages[i]}</p>
      <button style={{background:'#10b981',color:'#000',border:'none',borderRadius:999,padding:'0.8rem 2rem',fontSize:'1rem',fontWeight:700,cursor:'pointer'}}>Get Started Free</button>
    </main>
  )
}
