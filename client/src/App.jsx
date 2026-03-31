import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import VotePage from './pages/Vote';
import ResultsPage from './pages/Results';
import ThemeToggle from './components/ThemeToggle';

function Home() {
  return (

    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] text-center py-12 px-4">
      <ThemeToggle className="fixed bottom-3 right-3" />

      <div className="max-w-3xl glass-panel p-10 md:p-16 card-hover relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

        <div className="relative z-10">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-glow">
            Decentralized Voting
          </h1>
          <p className="text-xl md:text-2xl mb-10 text-foreground opacity-80 max-w-2xl mx-auto font-light">
            Secure, transparent, and immutable elections powered by Ethereum smart contracts. Experience the future of democracy.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <a href="/vote" className="cosmic-button text-lg">Cast Your Vote</a>
            <a href="/results" className="px-8 py-3 rounded-full font-semibold border-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsla(var(--primary),0.1)] transition-colors text-lg">See Results</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-purple-300 selection:text-purple-900 dark:selection:bg-purple-900 dark:selection:text-purple-100">
      <Navbar />
      <div className="container py-8 relative z-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vote" element={<VotePage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </div>
    </div>
  )
}
