/**
 * Single state store for the mock database.
 */
class Store {
  constructor() {
    this.state = {
      currentUser: null, // user role: 'voter' | 'admin'
      currentVoterName: "Alex Mercer",
      currentVoterId: "HTU-2026-8849",
      elections: [
        {
          id: "el-1",
          name: "University Student Council Presidential Election",
          description: "Vote for the next Student Council President to lead HTU initiatives, policy changes, and events for the academic year 2026/2027.",
          endsAt: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
          status: "active",
          category: "presidential",
          candidates: [
            {
              id: "cand-1",
              name: "Elena Rostova",
              position: "President",
              manifesto: "Driving sustainable campus energy policies, expanding student startup labs, and introducing digital academic counseling systems.",
              photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300",
              votes: 432
            },
            {
              id: "cand-2",
              name: "Marcus Vance",
              position: "President",
              manifesto: "Re-negotiating scholarship funding levels, creating direct administration-to-student feedback channels, and upgrading athletic complexes.",
              photo: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=300",
              votes: 389
            }
          ]
        },
        {
          id: "el-2",
          name: "Department of Computer Science Representative",
          description: "Annual representative vote for Computer Science faculty board and curriculum adjustment committee representation.",
          endsAt: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
          status: "active",
          category: "department",
          candidates: [
            {
              id: "cand-3",
              name: "Sarah Chen",
              position: "CS Rep",
              manifesto: "Fostering industry mentorship, organizing hackathons with tech companies, and upgrading student labs with modern development machines.",
              photo: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=300",
              votes: 210
            },
            {
              id: "cand-4",
              name: "Jordan Brooks",
              position: "CS Rep",
              manifesto: "Promoting opensource contributions, improving tutoring support networks, and securing department funding for project development.",
              photo: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=300",
              votes: 184
            }
          ]
        },
        {
          id: "el-3",
          name: "HTU Sports Club Board Members",
          description: "General board elections for sports facilities allocations, event funding boards, and club tournament operations management.",
          endsAt: new Date(Date.now() + 86400000 * 7).toISOString(),
          status: "upcoming",
          category: "sports",
          candidates: []
        },
        {
          id: "el-4",
          name: "Annual Budget Allocation Referendum",
          description: "Vote on proposed allocation of surplus university funds between campus construction projects vs student activity grants.",
          endsAt: new Date(Date.now() - 86400000 * 1).toISOString(), // ended 1 day ago
          status: "closed",
          category: "referendum",
          candidates: [
            { id: "cand-y", name: "Option A: Student Activity Grants", position: "Referendum", manifesto: "Direct all funds to student clubs.", photo: "", votes: 1205 },
            { id: "cand-n", name: "Option B: Athletic Complex Upgrades", position: "Referendum", manifesto: "Refurbish fields, pools, and gym.", photo: "", votes: 890 }
          ]
        }
      ],
      votesCast: [
        { id: "VT-2026-EX88A2", electionId: "el-4", electionName: "Annual Budget Allocation Referendum", timestamp: "2026-06-19T14:22:10Z" }
      ],
      alerts: [
        { id: "al-1", type: "critical", message: "Threat Level Spike: Multiple failed login attempts on student ID HTU-2026-3392 within 5 seconds.", timestamp: "11:43:21" },
        { id: "al-2", type: "high", message: "Security Warning: Voter IP mismatch. Single voter session accessed from 2 geographical endpoints.", timestamp: "11:38:05" },
        { id: "al-3", type: "medium", message: "System Event: Bulk registration attempts flagged from browser user agent with spoof signatures.", timestamp: "11:15:40" },
        { id: "al-4", type: "low", message: "General Alert: Rapid vote sequence detected in Room 420 Computer Cluster terminal session.", timestamp: "11:02:11" }
      ],
      auditNodes: [
        { id: "VT-2026-HN918A", hash: "9e7d3cf2a1b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1", prevHash: "8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c", timestamp: "2026-06-20T11:40:12Z", status: "valid" },
        { id: "VT-2026-PX742D", hash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2", prevHash: "9e7d3cf2a1b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1", timestamp: "2026-06-20T11:42:55Z", status: "valid" },
        { id: "VT-2026-WM295K", hash: "f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2", prevHash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2", timestamp: "2026-06-20T11:44:03Z", status: "valid" }
      ],
      selectedCandidates: {} // elId -> candId map during active voting flow
    };
  }

  save() {
    localStorage.setItem('votetrust_state', JSON.stringify(this.state));
  }

  load() {
    const saved = localStorage.getItem('votetrust_state');
    if (saved) {
      this.state = JSON.parse(saved);
    }
  }
}

window.Store = Store;
