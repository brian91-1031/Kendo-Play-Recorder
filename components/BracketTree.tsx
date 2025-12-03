
import React, { useMemo } from 'react';
import { Match, Player } from '../types';

interface BracketTreeProps {
  matches: Match[];
  players: Player[];
  rootMatchId: number;
}

// Visual component for a single match node
const MatchNode: React.FC<{ match: Match, players: Player[], allMatches: Match[] }> = ({ match: m, players, allMatches }) => {
    
    const getWaitingLabel = (matchId: number, slot: 'red' | 'white') => {
        // Find if any match feeds into this slot
        const winnerSource = allMatches.find(sourceMatch => 
            (sourceMatch.winnerToMatchId === matchId && sourceMatch.winnerToSlot === slot) ||
            (sourceMatch.winnerToMatchId === matchId && sourceMatch.winnerToSlot === null) 
        );
        if (winnerSource) return `Wait W-#${winnerSource.id}`;

        const loserSource = allMatches.find(sourceMatch => 
            (sourceMatch.loserToMatchId === matchId && sourceMatch.loserToSlot === slot) ||
            (sourceMatch.loserToMatchId === matchId && sourceMatch.loserToSlot === null)
        );
        if (loserSource) return `Wait L-#${loserSource.id}`;

        return "Waiting...";
    };

    const redName = m.redPlayerId ? players.find(p => p.id === m.redPlayerId)?.name : null;
    const whiteName = m.whitePlayerId ? players.find(p => p.id === m.whitePlayerId)?.name : null;

    return (
        <div className={`relative flex flex-col justify-center min-w-[200px] mb-4`}>
             <div className={`border rounded-lg bg-white shadow-sm p-2 text-sm transition-all duration-300 
                ${m.result ? 'border-slate-300 opacity-90' : 'border-blue-200 shadow-md ring-1 ring-blue-50'}
             `}>
                <div className="flex justify-between mb-1 pb-1 border-b border-gray-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Match #${m.id}</span>
                    {m.result && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full">完賽</span>}
                </div>
                
                {/* Red Player */}
                <div className={`flex items-center justify-between p-1 rounded-sm ${m.result?.winnerId === m.redPlayerId ? 'bg-red-50' : ''}`}>
                    <div className="flex items-center gap-2 overflow-hidden w-full">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.result?.winnerId === m.redPlayerId ? 'bg-red-600' : 'bg-red-300'}`}></div>
                        <span className={`truncate text-xs font-medium w-full ${m.result?.winnerId === m.redPlayerId ? 'text-red-700 font-bold' : 'text-slate-600'}`}>
                            {redName || <span className="text-slate-300 italic text-[10px]">{getWaitingLabel(m.id, 'red')}</span>}
                        </span>
                    </div>
                     {m.result && <span className="text-xs font-bold text-red-600 ml-1">{m.result.redScore}</span>}
                </div>

                {/* White Player */}
                <div className={`flex items-center justify-between p-1 rounded-sm mt-0.5 ${m.result?.winnerId === m.whitePlayerId ? 'bg-slate-100' : ''}`}>
                     <div className="flex items-center gap-2 overflow-hidden w-full">
                        <div className={`w-1.5 h-1.5 rounded-full border border-gray-400 bg-white shrink-0`}></div>
                        <span className={`truncate text-xs font-medium w-full ${m.result?.winnerId === m.whitePlayerId ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>
                            {whiteName || <span className="text-slate-300 italic text-[10px]">{getWaitingLabel(m.id, 'white')}</span>}
                        </span>
                    </div>
                     {m.result && <span className="text-xs font-bold text-slate-800 ml-1">{m.result.whiteScore}</span>}
                </div>
             </div>
             
             {/* Connector Line (Right - Output) */}
             <div className="absolute -right-4 top-1/2 w-4 h-px bg-slate-300 hidden md:block"></div>
        </div>
    )
}

export const BracketTree: React.FC<BracketTreeProps> = ({ matches, players, rootMatchId }) => {
  
  // Calculate the layout by finding "Distance from Root"
  const levels = useMemo(() => {
      const matchDepthMap = new Map<number, number>();
      const maxDepth = 10; // Safety limit

      // Helper to calculate depth recursively (Reverse DFS)
      const calculateDepth = (matchId: number, currentDepth: number) => {
          if (currentDepth > maxDepth) return;
          
          // Update depth if this path is longer (pushed further left)
          const existing = matchDepthMap.get(matchId) || -1;
          if (currentDepth > existing) {
              matchDepthMap.set(matchId, currentDepth);
          }

          // Find matches that feed INTO this match (either Winner OR Loser)
          const feeders = matches.filter(m => m.winnerToMatchId === matchId || m.loserToMatchId === matchId);
          feeders.forEach(f => calculateDepth(f.id, currentDepth + 1));
      };

      // Start from root
      calculateDepth(rootMatchId, 0);

      // Handle disconnected components (orphans) - assign them to deepest level available or level 0
      matches.forEach(m => {
          if (!matchDepthMap.has(m.id)) {
             // If unlinked, we try to place it based on if it feeds anything
             const parent = matches.find(p => p.id === m.winnerToMatchId || p.id === m.loserToMatchId);
             if (parent && matchDepthMap.has(parent.id)) {
                 calculateDepth(m.id, matchDepthMap.get(parent.id)! + 1);
             } else {
                 matchDepthMap.set(m.id, 0);
             }
          }
      });

      // Group by depth
      const maxFoundDepth = Math.max(...Array.from(matchDepthMap.values()), 0);
      const organizedLevels: Match[][] = [];

      // We want to render from Left (Max Depth) to Right (Depth 0)
      for (let d = maxFoundDepth; d >= 0; d--) {
          const depthMatches = matches
            .filter(m => matchDepthMap.get(m.id) === d)
            .sort((a,b) => a.id - b.id); // Sort by ID within level
          organizedLevels.push(depthMatches);
      }
      
      return organizedLevels;
  }, [matches, rootMatchId]);

  return (
    <div className="overflow-auto bracket-scroll p-6 bg-slate-50/50 rounded-xl border border-slate-100 h-full">
        <div className="flex gap-8 min-w-max h-full items-stretch">
            {levels.map((levelMatches, idx) => {
                const isFinal = idx === levels.length - 1;
                const roundName = isFinal ? "決賽 (Finals)" : `Round ${idx + 1}`;
                
                return (
                    <div key={idx} className="flex flex-col justify-around gap-4 min-w-[200px]">
                        <h3 className={`text-center font-bold text-xs tracking-wider uppercase mb-2 sticky top-0 py-2 z-10 backdrop-blur-sm ${isFinal ? 'text-yellow-600 bg-yellow-50/90' : 'text-slate-400 bg-slate-50/90'}`}>
                            {roundName}
                        </h3>
                        <div className="flex flex-col justify-center h-full gap-8">
                            {levelMatches.map(m => (
                                <MatchNode 
                                    key={m.id} 
                                    match={m} 
                                    players={players} 
                                    allMatches={matches}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};