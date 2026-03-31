// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Voting {

    struct Candidate {
        uint id;
        string name;
        uint voteCount;
    }

    struct Election {
        uint id;
        string name;
        bool isActive;
        uint candidateCount;
        mapping(uint => Candidate) candidates;
        bool candidatesLocked;
        uint256 endTime;
    }

    // Admin hardcoded in contract for security (set at compile time)
    address public admin = 0x093Cda0c06d9E7920cD472273547edcD54aBDfa3;
    uint public electionCount;
    // Total votes across all elections
    uint public totalVotes;
    mapping(uint => Election) elections;

    // Global per-election vote tracker: electionId => (voter => bool)
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    // store winner id for each election (0 = none)
    mapping(uint => uint) public electionWinner;



    event ElectionCreated(uint electionId, string name);
    event CandidateAdded(uint electionId, uint candidateId, string name);
    event VoteCast(uint electionId, uint candidateId, address voter);
    event ElectionConcluded(uint electionId, uint winnerId, string winnerName, uint winnerVotes);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this");
        _;
    }


    // main functions ---
    function createElection(string memory _name, string[] memory _candidateNames, uint256 _durationSeconds) public onlyAdmin {
        electionCount++;
        Election storage e = elections[electionCount];
        e.id = electionCount;
        e.name = _name;
        e.isActive = true;
        e.candidateCount = 0;
        e.endTime = block.timestamp + _durationSeconds;

        // Add initial candidates provided at setup
        for (uint i = 0; i < _candidateNames.length; i++) {
            e.candidateCount++;
            e.candidates[e.candidateCount] = Candidate(e.candidateCount, _candidateNames[i], 0);
            emit CandidateAdded(electionCount, e.candidateCount, _candidateNames[i]);
        }

        // Lock candidate additions after setup
        e.candidatesLocked = true;

        emit ElectionCreated(electionCount, _name);
    }

    function addCandidate(uint _electionId, string memory _name) public onlyAdmin {
        Election storage e = elections[_electionId];
        require(e.isActive, "Election not active");
        require(!e.candidatesLocked, "Candidates are locked for this election");

        e.candidateCount++;
        e.candidates[e.candidateCount] = Candidate(e.candidateCount, _name, 0);

        emit CandidateAdded(_electionId, e.candidateCount, _name);
    }

    event CandidateRemoved(uint electionId, uint candidateId);
    function removeCandidate(uint _electionId, uint _candidateId) public onlyAdmin {
        Election storage e = elections[_electionId];
        require(e.isActive, "Election not active");
        require(_candidateId > 0 && _candidateId <= e.candidateCount, "Invalid candidateId");

        uint lastId = e.candidateCount;
        if (_candidateId != lastId) {
            // move last candidate into the removed slot
            e.candidates[_candidateId] = e.candidates[lastId];
            e.candidates[_candidateId].id = _candidateId;
        }

        // delete the last candidate
        delete e.candidates[lastId];
        e.candidateCount--;

        emit CandidateRemoved(_electionId, _candidateId);
    }


    // --- Voter functions ---
    function vote(uint256 electionId, uint256 candidateId) public {
        require(electionId > 0 && electionId <= electionCount, "Invalid electionId");

        Election storage e = elections[electionId];
        require(e.isActive, "Election is not active");
        require(block.timestamp < e.endTime, "Election has ended");

        require(candidateId > 0 && candidateId <= e.candidateCount, "Invalid candidateId");

        require(!hasVoted[electionId][msg.sender], "You have already voted");

        // Mark voter as voted
        hasVoted[electionId][msg.sender] = true;

        // Add vote to candidate
        e.candidates[candidateId].voteCount++;
        // Increment global total votes
        totalVotes++;

        emit VoteCast(electionId, candidateId, msg.sender);
    }

    // Conclude an election: lock it, compute winner and emit results
    function concludeElection(uint _electionId) public onlyAdmin {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid electionId");
        Election storage e = elections[_electionId];
        require(e.isActive, "Election not active");
        require(block.timestamp >= e.endTime, "Election has not ended yet");

        e.isActive = false;

        uint winnerId = 0;
        uint winnerVotes = 0;
        for (uint i = 1; i <= e.candidateCount; i++) {
            uint v = e.candidates[i].voteCount;
            if (v > winnerVotes) {
                winnerVotes = v;
                winnerId = i;
            }
        }

        electionWinner[_electionId] = winnerId;

        string memory winnerName = "";
        if (winnerId != 0) {
            winnerName = e.candidates[winnerId].name;
        }

        emit ElectionConcluded(_electionId, winnerId, winnerName, winnerVotes);
    }

    // Auto-conclude election if time has passed
    function autoCheckAndConcludeElection(uint _electionId) public onlyAdmin {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid electionId");
        Election storage e = elections[_electionId];
        
        if (e.isActive && block.timestamp >= e.endTime) {
            concludeElection(_electionId);
        }
    }


    // --- Read functions ---
    function getCandidate(uint _electionId, uint _candidateId) public view returns (Candidate memory) {
        return elections[_electionId].candidates[_candidateId];
    }

    function getElection(uint _electionId) public view returns (
        uint id,
        string memory name,
        bool isActive,
        uint candidateCount,
        uint256 endTime
    ) {
        Election storage e = elections[_electionId];
        return (e.id, e.name, e.isActive, e.candidateCount, e.endTime);
    }

    // Check whether an address has voted in a specific election
    function hasVotedInElection(uint _electionId, address _voter) public view returns (bool) {
        return hasVoted[_electionId][_voter];
    }

    // Get current block timestamp
    function getCurrentTimestamp() public view returns (uint256) {
        return block.timestamp;
    }

    // Return results for an election: arrays of ids, names and vote counts, plus winnerId
    function getElectionResults(uint _electionId) public view returns (
        uint[] memory ids,
        string[] memory names,
        uint[] memory votes,
        uint winnerId
    ) {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid electionId");
        Election storage e = elections[_electionId];
        uint count = e.candidateCount;

        ids = new uint[](count);
        names = new string[](count);
        votes = new uint[](count);

        winnerId = 0;
        uint winnerVotes = 0;

        for (uint i = 0; i < count; i++) {
            uint idx = i + 1; // candidate ids are 1-based
            Candidate storage c = e.candidates[idx];
            ids[i] = c.id;
            names[i] = c.name;
            votes[i] = c.voteCount;
            
            // Calculate winner based on highest vote count
            if (c.voteCount > winnerVotes) {
                winnerVotes = c.voteCount;
                winnerId = c.id;
            }
        }
    }
}
