import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [metamaskAvailable, setMetamaskAvailable] = useState(false);

  useEffect(() => {
    const checkMetaMask = () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        setMetamaskAvailable(true);
        const savedAccount = localStorage.getItem('connectedAccount');
        if (savedAccount) setAccount(savedAccount);
        else setAccount(null);
      } else {
        setMetamaskAvailable(false);
      }
    };
    checkMetaMask();
    window.addEventListener('ethereum#initialized', checkMetaMask);
    return () => window.removeEventListener('ethereum#initialized', checkMetaMask);
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('MetaMask is not installed. Please install it from https://metamask.io');
      return;
    }
    try {
      setLoading(true);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        const selectedAccount = accounts[0];
        setAccount(selectedAccount);
        localStorage.setItem('connectedAccount', selectedAccount);
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const disconnectWallet = async () => {
    setAccount(null);
    localStorage.removeItem('connectedAccount');
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }]
        });
      } catch (error) { }
    }
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <nav className="glass-panel sticky top-4 z-50 mx-4 mt-4 lg:mx-auto lg:max-w-5xl px-6 py-4 flex items-center justify-between border-t border-b border-l border-r border-solid border-[var(--glass-border)] rounded-2xl shadow-xl">
      <div className="flex items-center gap-6">
        <Link to="/" className="text-2xl font-bold text-glow tracking-tight">DeVote</Link>
        <div className="hidden md:flex gap-4">
          <Link to="/vote" className="text-[15px] font-medium opacity-80 hover:opacity-100 hover:text-[hsl(var(--primary))] transition-all">Vote</Link>
          <Link to="/results" className="text-[15px] font-medium opacity-80 hover:opacity-100 hover:text-[hsl(var(--primary))] transition-all">Results</Link>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {account ? (
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-[hsla(var(--primary),0.1)] text-[hsl(var(--primary))] border border-[hsla(var(--primary),0.2)] rounded-full text-sm font-semibold tracking-wide">
              {formatAddress(account)}
            </div>
            <button
              onClick={disconnectWallet}
              className="px-4 py-2 rounded-full bg-[hsla(0,80%,50%,0.1)] text-red-500 hover:bg-red-500 hover:text-white transition-colors text-sm font-semibold"
              type="button"
              title="Disconnect wallet"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            disabled={loading || !metamaskAvailable}
            className="cosmic-button text-sm !px-5 !py-2"
            type="button"
          >
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
        <div className="ml-2 pl-4 border-l border-[var(--glass-border)]">
        </div>
      </div>
    </nav>
  );
}
