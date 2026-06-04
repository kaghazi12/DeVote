import { useEffect, useState } from 'react';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../utils/contractConfig';
import { BrowserProvider, Contract, JsonRpcProvider } from 'ethers';
import ThemeToggle from '../components/ThemeToggle';

export default function ResultsPage() {
  const [elections, setElections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [totalVotes, setTotalVotes] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success] = useState(null);
  //const [advancingTime, setAdvancingTime] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const provider = window.ethereum ? new BrowserProvider(window.ethereum) : new JsonRpcProvider(process.env.REACT_APP_RPC_URL);
        const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const countBn = await contract.electionCount();
        const count = Number(countBn.toString());
        const currentTime = await contract.getCurrentTimestamp();
        const currentTimestamp = Number(currentTime.toString());
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
        if (!cancelled) {
          setElections(list);
          if (list.length > 0) setSelected(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load elections', err);
        if (!cancelled) setError('Failed to load elections');
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const fetchResults = async (id) => {
    setError(null);
    if (!id) return;
    setLoading(true);
    setResults(null);
    try {
      const provider = window.ethereum ? new BrowserProvider(window.ethereum) : new JsonRpcProvider(process.env.REACT_APP_RPC_URL);
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      const e = await contract.getElection(Number(id));

      // Calculate total votes from candidates for this election
      const candidateCount = Number(e.candidateCount);
      let electionTotalVotes = 0;
      for (let i = 1; i <= candidateCount; i++) {
        const cand = await contract.getCandidate(Number(id), i);
        electionTotalVotes += Number(cand.voteCount);
      }
      setTotalVotes(electionTotalVotes);

      // Check if election time has ended - same logic as Vote.jsx
      const currentTime = await contract.getCurrentTimestamp();
      const currentTimestamp = Number(currentTime.toString());
      const electionEndTime = Number(e.endTime);
      const hasTimeEnded = electionEndTime <= currentTimestamp;

      console.log(`Results fetchResults for election ${id}:`, {
        contractIsActive: e.isActive,
        endTime: electionEndTime,
        currentTime: currentTimestamp,
        hasTimeEnded: hasTimeEnded
      });

      // If election time hasn't ended yet, show "ongoing" message
      if (!hasTimeEnded) {
        setResults({ ongoing: true });
        setLoading(false);
        return;
      }

      // Election is concluded - fetch and show results
      const res = await contract.getElectionResults(Number(id));
      const ids = res[0].map((v) => Number(v.toString()));
      const names = res[1].map((s) => s);
      const votes = res[2].map((v) => Number(v.toString()));
      const winnerId = Number(res[3].toString());

      console.log('Results:', { ids, names, votes, winnerId });
      console.log('Winner index:', ids.indexOf(winnerId));

      setResults({ ongoing: false, ids, names, votes, winnerId });
    } catch (err) {
      console.error('Failed to fetch results', err);
      setError('Failed to fetch results');
    } finally {
      setLoading(false);
    }
  };
/*
  const advanceTime = async () => {
    try {
      setAdvancingTime(true);
      const provider = new JsonRpcProvider('http://127.0.0.1:8545');

      // Advance time by 4000 seconds using evm_increaseTime and mine a block
      console.log('Advancing time...');
      await provider.send('evm_increaseTime', [4000]);
      await provider.send('evm_mine', []);

      // Reload elections and results
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const currentTime = await contract.getCurrentTimestamp();
      const currentTimestamp = Number(currentTime.toString());
      console.log(`Time advanced. Current blockchain timestamp: ${currentTimestamp}`);

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

      // Refresh results for current election
      if (selected) {
        fetchResults(selected);
      }

      setSuccess('Time advanced by 1 hour');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to advance time:', err);
      setError('Failed to advance time (only works on local network)');
    } finally {
      setAdvancingTime(false);
    }
  };
*/
  useEffect(() => {
    if (selected !== null) fetchResults(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <div className="container">
      <ThemeToggle className="fixed bottom-3 right-3" />
      <h1 className="text-4xl font-extrabold tracking-tight text-glow mb-6">Election Results</h1>

      <div className="mb-4">
        <strong>Total votes cast:</strong> {totalVotes === null ? 'Loading...' : totalVotes}
      </div>

      {error && <div className="text-red-500 mb-4 p-3 bg-red-900 bg-opacity-20 rounded">❌ {error}</div>}
      {success && <div className="text-green-500 mb-4 p-3 bg-green-900 bg-opacity-20 rounded">✓ {success}</div>}

      <div className="mb-4 sm:flex sm:items-center gap-3 grid grid-cols-2">
        <label className="mr-2">Select Election:</label>
        <select value={selected ?? ''} onChange={(e) => setSelected(Number(e.target.value))} className="border p-2 rounded text-forground bg-background">
          {elections.map((el) => (
            <option key={el.id} value={el.id}>{el.name} {el.isActive ? '(ongoing)' : '(concluded)'}</option>
          ))}
        </select>
        <button className="cosmic-button ml-2" onClick={() => fetchResults(selected)}>Refresh</button>
      </div>

      {loading && <div>Loading results...</div>}

      {!loading && results && results.ongoing && (
        <div className="text-yellow-500 p-3 bg-background bg-opacity-20 rounded">Election is still ongoing</div>
      )}

      {!loading && results && !results.ongoing && (
        <div>
          <div className="mb-4">Results for <strong>{elections.find(e => e.id === selected)?.name}</strong></div>
          <div className="table-wrap">
            <table className="table bg-background">
              <thead>
                <tr>
                  <th className="px-4 py-2">Candidate ID</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Votes</th>
                </tr>
              </thead>
              <tbody>
                {results.ids.map((cid, idx) => (
                  <tr key={cid} className={cid === results.winnerId ? 'winner' : ''}>
                    <td className="border-gray-600 px-4 py-2">{cid}</td>
                    <td className="border-gray-600 px-4 py-2">{results.names[idx]}</td>
                    <td className="border-gray-600 px-4 py-2">{results.votes[idx]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.winnerId > 0 ? (
              <div className="mt-2 text-sm text-primary">Winner: {results.names[results.ids.indexOf(Number(results.winnerId))]}</div>
            ) : (
              <div className="mt-2 text-sm text-foreground opacity-60">No winner determined</div>
            )}
          </div>
        </div>
      )}

      {!loading && !results && (
        <div className="text-gray-500">Select an election to view results.</div>
      )}

    </div>
  );
}
