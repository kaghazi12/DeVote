import React, { useEffect, useState } from 'react';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../utils/contractConfig';
import { BrowserProvider, Contract, JsonRpcProvider } from 'ethers';
import ThemeToggle from '../components/ThemeToggle';

export default function VotePage() {
  const [elections, setElections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [account, setAccount] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [totalVotes, setTotalVotes] = useState(null);
  const [electionHasEnded, setElectionHasEnded] = useState(false);

  // Load elections on mount
  useEffect(() => {
    async function loadElections() {
      try {
        const provider = window.ethereum
          ? new BrowserProvider(window.ethereum)
          : new JsonRpcProvider('http://127.0.0.1:8545');
        const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

        const currentTime = await contract.getCurrentTimestamp();
        const currentTimestamp = Number(currentTime.toString());

        const countBn = await contract.electionCount();
        const count = Number(countBn.toString());
        const list = [];

        for (let i = 1; i <= count; i++) {
          const e = await contract.getElection(i);
          const electionEndTime = Number(e.endTime);
          const hasTimeEnded = electionEndTime <= currentTimestamp;
          const shouldBeActive = e.isActive && !hasTimeEnded;

          list.push({
            id: Number(e.id),
            name: e.name,
            isActive: shouldBeActive,
            candidateCount: Number(e.candidateCount),
            endTime: electionEndTime
          });
        }

        setElections(list);
        if (list.length > 0) setSelected(list[0].id);
      } catch (err) {
        setError('Failed to load elections: ' + (err?.message || err));
      }
    }

    loadElections();
  }, []);

  // Get account from MetaMask
  useEffect(() => {
    async function getAccount() {
      try {
        if (!window.ethereum) return;
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) setAccount(accounts[0]);
      } catch (err) {
        console.error('Failed to get account:', err);
      }
    }
    getAccount();
  }, []);

  // Load candidates and check if user has voted
  useEffect(() => {
    async function loadCandidates() {
      if (!selected) return;

      try {
        setLoading(true);
        setError(null);

        const provider = window.ethereum
          ? new BrowserProvider(window.ethereum)
          : new JsonRpcProvider('http://127.0.0.1:8545');
        const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

        const election = await contract.getElection(Number(selected));

        const currentTime = await contract.getCurrentTimestamp();
        const currentTimestamp = Number(currentTime.toString());
        const electionEndTime = Number(election.endTime);
        const hasTimeEnded = electionEndTime <= currentTimestamp;

        setElectionHasEnded(hasTimeEnded);

        setElections(prev => prev.map(el =>
          el.id === selected
            ? { ...el, isActive: election.isActive && !hasTimeEnded }
            : el
        ));

        const candidateCount = Number(election.candidateCount);
        const cands = [];

        for (let i = 1; i <= candidateCount; i++) {
          const cand = await contract.getCandidate(Number(selected), i);
          cands.push({
            id: Number(cand[0] || cand.id),
            name: cand[1] || cand.name,
            voteCount: Number(cand[2] || cand.voteCount)
          });
        }

        setCandidates(cands);

        const electionTotal = cands.reduce((sum, cand) => sum + cand.voteCount, 0);
        setTotalVotes(electionTotal);

        if (account) {
          const voted = await contract.hasVotedInElection(Number(selected), account);
          setHasVoted(voted);
        }
      } catch (err) {
        setError('Failed to load candidates: ' + (err?.message || err));
      } finally {
        setLoading(false);
      }
    }

    loadCandidates();
  }, [selected, account]);

  // Recalculate total votes whenever candidates change
  useEffect(() => {
    if (candidates && candidates.length > 0) {
      const electionTotal = candidates.reduce((sum, cand) => sum + cand.voteCount, 0);
      setTotalVotes(electionTotal);
    }
  }, [candidates]);

  // Listen for ElectionConcluded events
  useEffect(() => {
    const setupEventListener = async () => {
      try {
        const provider = window.ethereum
          ? new BrowserProvider(window.ethereum)
          : new JsonRpcProvider('http://127.0.0.1:8545');
        const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

        const filter = contract.filters.ElectionConcluded();
        contract.on(filter, (electionId, winnerId, winnerName, winnerVotes) => {
          setElections(prev => prev.map(el =>
            el.id === Number(electionId) ? { ...el, isActive: false } : el
          ));
          if (Number(electionId) === selected) {
            async function reloadCandidates() {
              try {
                const election = await contract.getElection(Number(selected));
                const candidateCount = Number(election.candidateCount);
                const cands = [];
                for (let i = 1; i <= candidateCount; i++) {
                  const cand = await contract.getCandidate(Number(selected), i);
                  cands.push({ id: Number(cand.id), name: cand.name, voteCount: Number(cand.voteCount) });
                }
                setCandidates(cands);
              } catch (err) { }
            }
            reloadCandidates();
          }
        });
        return () => contract.off(filter);
      } catch (err) { }
    };
    setupEventListener();
  }, [selected]);

  // Poll election status every second
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const provider = window.ethereum
          ? new BrowserProvider(window.ethereum)
          : new JsonRpcProvider('http://127.0.0.1:8545');
        const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

        const currentTime = await contract.getCurrentTimestamp();
        const currentTimestamp = Number(currentTime.toString());

        if (selected) {
          const election = elections.find(e => e.id === selected);
          if (election) {
            const hasTimeEnded = Number(election.endTime) <= currentTimestamp;
            if (hasTimeEnded !== electionHasEnded) {
              setElectionHasEnded(hasTimeEnded);
            }
          }
        }
      } catch (err) { }
    }, 1000);
    return () => clearInterval(interval);
  }, [selected, elections, electionHasEnded]);

  const handleVote = async (candidateId) => {
    if (!account) { setError('Please connect your wallet first'); return; }
    if (!window.ethereum) { setError('MetaMask is required to vote'); return; }

    try {
      setVoting(true); setError(null); setSuccess(null);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.vote(Number(selected), candidateId);
      await tx.wait();

      setSuccess('Vote cast successfully!');
      setHasVoted(true);

      const election = await contract.getElection(Number(selected));
      const candidateCount = Number(election.candidateCount);
      const cands = [];
      for (let i = 1; i <= candidateCount; i++) {
        const cand = await contract.getCandidate(Number(selected), i);
        cands.push({ id: Number(cand.id), name: cand.name, voteCount: Number(cand.voteCount) });
      }
      setCandidates(cands);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      if (err.reason && (err.reason.includes('ended') || err.reason.includes('concluded'))) {
        setElections(prev => prev.map(el => el.id === selected ? { ...el, isActive: false } : el));
        setError('This election has concluded. Voting is no longer allowed.');
      } else if (err.reason) { setError(err.reason); }
      else { setError('Failed to cast vote. Please try again.'); }
    } finally {
      setVoting(false);
    }
  };

  const election = elections.find(e => e.id === selected);

  return (
    <div className="container max-w-4xl py-6 relative z-10">
      <ThemeToggle className="fixed bottom-3 right-3" />

      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-glow">
          Elect Your Leader
        </h1>
        {account ? (
          <div className="px-4 py-2 glass-panel border border-[hsla(142,70%,50%,0.3)] text-[hsl(142,70%,40%)] dark:text-[hsl(142,80%,65%)] font-semibold rounded-full text-sm shadow-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Connected: {account.substring(0, 6)}...{account.substring(account.length - 4)}
          </div>
        ) : (
          <div className="px-4 py-2 glass-panel border border-[hsla(0,0%,50%,0.3)] text-foreground opacity-70 font-semibold rounded-full text-sm">
            Wallet Offline
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 p-4 rounded-xl glass-panel border-l-4 border-red-500 bg-red-100 dark:bg-[hsla(0,100%,70%,0.1)] text-red-700 dark:text-red-300 font-medium">
          <span className="mr-2">❌</span> {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 rounded-xl glass-panel border-l-4 border-green-500 bg-green-100 dark:bg-[hsla(142,70%,50%,0.1)] text-green-700 dark:text-green-300 font-medium">
          <span className="mr-2">✓</span> {success}
        </div>
      )}

      {/* Main Container */}
      <div className="glass-panel p-6 md:p-8 rounded-2xl mb-8 relative">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-6 border-b border-[var(--glass-border)] gap-6">
          <div className="w-full md:w-2/3">
            <label className="block mb-2 text-sm font-semibold tracking-wider text-[hsl(var(--primary))] uppercase opacity-80">
              Active Election
            </label>
            {elections.length === 0 ? (
              <select disabled className="w-full text-lg cursor-not-allowed opacity-50"><option>No elections available</option></select>
            ) : (
              <select
                value={selected ?? ''}
                onChange={(e) => { setSelected(Number(e.target.value)); setHasVoted(false); }}
                className="w-full text-lg font-medium outline-none focus:ring-0 shadow-sm"
              >
                {elections.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.name} {el.isActive ? '(Active)' : '(Closed)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="glass-panel py-3 px-6 rounded-xl flex items-center gap-4 border border-[hsla(var(--primary),0.2)] bg-[hsla(var(--primary),0.03)] w-full md:w-auto shrink-0 justify-center shadow-inner">
            <span className="text-sm font-semibold opacity-70">Total Cast:</span>
            <span className="text-3xl font-extrabold text-[hsl(var(--primary))]">{totalVotes}</span>
          </div>
        </div>

        {election && election.isActive && hasVoted && (
          <div className="mb-8 p-4 py-5 glass-panel text-[hsl(var(--primary))] rounded-xl text-center font-bold tracking-tight text-lg border border-[hsla(var(--primary),0.2)] background-pulse flex justify-center items-center gap-3">
            <span className="text-2xl opacity-80">🗳️</span> Your vote has been recorded and secured on the blockchain.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-10 w-10 border-4 border-[hsla(var(--primary),0.3)] border-t-[hsl(var(--primary))] rounded-full animate-spin"></div>
          </div>
        ) : candidates.length === 0 && elections.length > 0 ? (
          <p className="text-center font-medium opacity-60 p-8">No candidates are registered for this election.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="gradient-border group"
              >
                <div className="h-full p-6 flex flex-col justify-between items-center text-center card-hover overflow-hidden relative">
                  {/* Subtle candidate background glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[hsl(var(--primary))] rounded-full mix-blend-multiply opacity-0 group-hover:opacity-10 filter blur-3xl transition duration-500"></div>

                  <div className="w-16 h-16 rounded-full bg-[hsla(var(--primary),0.1)] flex items-center justify-center mb-4 text-2xl border border-[hsla(var(--primary),0.2)] shadow-sm">
                    👤
                  </div>

                  <h3 className="text-xl font-bold mb-2 break-words w-full">{candidate.name}</h3>
                  <div className="text-sm font-medium mb-6 opacity-60">Candidate #{candidate.id}</div>

                  {election.isActive && !electionHasEnded ? (
                    <button
                      onClick={() => handleVote(candidate.id)}
                      disabled={voting || hasVoted || !account}
                      className={`w-full py-3 rounded-xl font-semibold transition-all relative z-10 ${hasVoted || !account
                          ? 'bg-gray-200 dark:bg-[hsla(0,0%,30%,0.3)] text-gray-400 cursor-not-allowed border border-transparent blur-[1px] hover:blur-none'
                          : voting
                            ? 'bg-[hsla(var(--primary),0.8)] text-white cursor-wait animate-pulse'
                            : 'cosmic-button !text-[15px] shadow-lg hover:shadow-[hsl(var(--primary))] border border-transparent'
                        }`}
                    >
                      {voting ? 'Casting...' : hasVoted ? 'Recorded' : 'Cast Ballot'}
                    </button>
                  ) : (
                    <div className="w-full py-3 rounded-xl font-semibold bg-gray-200 dark:bg-[hsla(0,0%,20%,0.5)] text-gray-500 dark:text-gray-400 cursor-not-allowed border border-[hsla(0,0%,50%,0.1)] text-[15px] shadow-inner">
                      Polls Closed
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
