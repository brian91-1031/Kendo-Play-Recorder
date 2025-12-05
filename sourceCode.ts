
export const FILES = {
  "metadata.json": `{
  "name": "Kendo Bracket Master",
  "description": "A smart Kendo tournament manager that uses AI to parse brackets, manages match progression, records detailed scores, and visualizes the tournament tree.",
  "requestFramePermissions": []
}`,
  "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kendo Bracket Master</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Noto Sans TC', sans-serif;
        background-color: #f3f4f6;
      }
      /* Custom Scrollbar for bracket view */
      .bracket-scroll::-webkit-scrollbar {
        height: 8px;
        width: 8px;
      }
      .bracket-scroll::-webkit-scrollbar-track {
        background: #f1f1f1;
      }
      .bracket-scroll::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      .bracket-scroll::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    </style>
  <script type="importmap">
{
  "imports": {
    "react/": "https://aistudiocdn.com/react@^19.2.0/",
    "react": "https://aistudiocdn.com/react@^19.2.0",
    "@google/genai": "https://aistudiocdn.com/@google/genai@^1.30.0",
    "lucide-react": "https://aistudiocdn.com/lucide-react@^0.554.0",
    "react-dom/": "https://aistudiocdn.com/react-dom@^19.2.0/",
    "jszip": "https://jspm.dev/jszip"
  }
}
</script>
</head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>`,
  "index.tsx": `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
  "types.ts": `
export interface Player {
  id: string;
  name: string;
}

export interface MatchResult {
  winnerId: string;
  redScore: number;
  whiteScore: number;
  details: string; // e.g. "Men, Kote"
}

export interface Match {
  id: number;
  // If null, it means the slot is waiting for a winner from another match
  redPlayerId: string | null; 
  whitePlayerId: string | null;
  
  // Navigation logic
  winnerToMatchId: number | null; // ID of the next match the winner goes to
  winnerToSlot: 'red' | 'white' | null; // Explicitly target a slot
  
  loserToMatchId: number | null; // Optional
  loserToSlot: 'red' | 'white' | null; // Explicitly target a slot
  
  result: MatchResult | null;
}

export interface TournamentData {
  id: string; // Unique ID for storage
  lastUpdated: number; // Timestamp
  title: string;
  players: Player[];
  matches: Match[];
  totalMatches: number;
  status: 'SETUP' | 'ACTIVE' | 'FINISHED';
}

export interface ExtractedData {
  title: string;
  totalMatches: number;
  players: string[];
}`,
  "services/geminiService.ts": `import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeBracketImage = async (base64Image: string): Promise<ExtractedData> => {
  try {
    const prompt = \`
      Analyze this Kendo tournament bracket image.
      
      Tasks:
      1. **Title**: Find the main title at the top (e.g., "個人賽-國中女子組").
      2. **Total Matches**: Look for the number at the very top root of the bracket tree. This number usually represents the total number of matches or the final match ID. Return this as 'totalMatches'.
      3. **Players**: Identify all player names. 
         - They are usually located at the very bottom of the tree.
         - **Crucial**: The names are often written vertically (one character per line) in Chinese.
         - Read the vertical columns from left to right (or based on the numbers 1, 2, 3... above them if present).
         - Combine the vertical characters into full names (e.g., "王小明").
      
      Return JSON only.
    \`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            totalMatches: { type: Type.INTEGER },
            players: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["title", "totalMatches", "players"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as ExtractedData;
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error;
  }
};`,
  "components/MatchCard.tsx": `
import React from 'react';
import { Match, Player } from '../types';

interface MatchCardProps {
  match: Match;
  players: Player[];
  onScore: (matchId: number) => void;
  onWalkover: (matchId: number) => void;
  highlight?: boolean;
  sourceCount: number; // Number of matches feeding into this one
  redSourceExist?: boolean;
  whiteSourceExist?: boolean;
}

export const MatchCard: React.FC<MatchCardProps> = ({ 
    match, 
    players, 
    onScore, 
    onWalkover, 
    highlight, 
    sourceCount,
    redSourceExist = false,
    whiteSourceExist = false
}) => {
  const getPlayerName = (id: string | null) => {
    if (!id) return null;
    const p = players.find(p => p.id === id);
    return p ? p.name : "未知選手";
  };

  const redName = getPlayerName(match.redPlayerId);
  const whiteName = getPlayerName(match.whitePlayerId);
  
  const isFinished = !!match.result;
  
  // Ready: Both players present
  const isReady = match.redPlayerId && match.whitePlayerId && !match.result;
  
  // Bye / Walkover Logic:
  // We need to know if a slot is "effectively empty" (empty AND no one is coming).
  const isRedEmpty = !match.redPlayerId && !redSourceExist;
  const isWhiteEmpty = !match.whitePlayerId && !whiteSourceExist;

  const hasRed = !!match.redPlayerId || redSourceExist;
  const hasWhite = !!match.whitePlayerId || whiteSourceExist;

  // It is a bye if:
  // 1. Not finished
  // 2. One side has presence (Player or Source)
  // 3. The OTHER side is completely empty (No player AND No source)
  const isBye = !match.result && ((hasRed && isWhiteEmpty) || (hasWhite && isRedEmpty));

  return (
    <div 
      className={\`relative border rounded-xl p-4 shadow-sm bg-white flex flex-col gap-3 transition-all duration-300 hover:shadow-md
      \${highlight ? 'ring-2 ring-blue-500' : ''} 
      \${isFinished ? 'bg-gray-50/80' : 'border-slate-200'}
      \`}
    >
      <div className="flex justify-between items-center text-xs font-bold border-b border-gray-100 pb-2 mb-1">
        <span className="text-slate-400">MATCH #\${match.id}</span>
        {match.result && <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full">已完賽</span>}
        {!match.result && isReady && <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">進行中</span>}
        {!match.result && isBye && <span className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">輪空待命</span>}
      </div>

      <div className="flex justify-between items-center gap-2">
        {/* Red Side */}
        <div className={\`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors \${match.result?.winnerId === match.redPlayerId ? 'bg-red-50 ring-1 ring-red-100' : ''}\`}>
          <div className="w-full h-1 bg-red-500 mb-2 rounded-full opacity-80"></div>
          <span className={\`font-medium text-sm text-center break-all line-clamp-2 min-h-[2.5em] flex items-center \${match.result?.winnerId === match.redPlayerId ? 'text-red-700 font-bold' : 'text-slate-700'}\`}>
            {redName || <span className="text-gray-300 italic text-xs">等待中...</span>}
          </span>
          {isFinished ? (
               <span className="text-2xl font-black text-red-600 mt-1">{match.result?.redScore}</span>
          ) : (
               <span className="text-2xl font-black text-transparent mt-1 select-none">-</span>
          )}
        </div>

        <div className="flex flex-col items-center justify-center">
             <span className="text-slate-300 text-xs font-bold">VS</span>
        </div>

        {/* White Side */}
        <div className={\`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors \${match.result?.winnerId === match.whitePlayerId ? 'bg-gray-100 ring-1 ring-gray-200' : ''}\`}>
          <div className="w-full h-1 bg-white border border-gray-300 mb-2 rounded-full"></div>
          <span className={\`font-medium text-sm text-center break-all line-clamp-2 min-h-[2.5em] flex items-center \${match.result?.winnerId === match.whitePlayerId ? 'text-slate-900 font-bold' : 'text-slate-700'}\`}>
            {whiteName || <span className="text-gray-300 italic text-xs">等待中...</span>}
          </span>
          {isFinished ? (
               <span className="text-2xl font-black text-slate-700 mt-1">{match.result?.whiteScore}</span>
          ) : (
               <span className="text-2xl font-black text-transparent mt-1 select-none">-</span>
          )}
        </div>
      </div>

      {isReady && (
        <button
          onClick={() => onScore(match.id)}
          className="mt-2 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm active:translate-y-0.5"
        >
          紀錄比分
        </button>
      )}
      
      {isBye && (
        <button
          onClick={() => onWalkover(match.id)}
          className="mt-2 w-full py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-200 text-sm font-bold rounded-lg transition-colors shadow-sm active:translate-y-0.5 flex items-center justify-center gap-1"
        >
           輪空晉級 (Walkover)
        </button>
      )}

      {isFinished && (
        <div className="text-xs text-center text-gray-500 mt-1 px-2 py-1 bg-gray-50 rounded border border-gray-100 truncate">
          {match.result?.details || '無詳細紀錄'}
        </div>
      )}
    </div>
  );
};`,
  "components/BracketTree.tsx": `
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
        if (winnerSource) return \`Wait W-#\${winnerSource.id}\`;

        const loserSource = allMatches.find(sourceMatch => 
            (sourceMatch.loserToMatchId === matchId && sourceMatch.loserToSlot === slot) ||
            (sourceMatch.loserToMatchId === matchId && sourceMatch.loserToSlot === null)
        );
        if (loserSource) return \`Wait L-#\${loserSource.id}\`;

        return "Waiting...";
    };

    const redName = m.redPlayerId ? players.find(p => p.id === m.redPlayerId)?.name : null;
    const whiteName = m.whitePlayerId ? players.find(p => p.id === m.whitePlayerId)?.name : null;

    return (
        <div className={\`relative flex flex-col justify-center min-w-[200px] mb-4\`}>
             <div className={\`border rounded-lg bg-white shadow-sm p-2 text-sm transition-all duration-300 
                \${m.result ? 'border-slate-300 opacity-90' : 'border-blue-200 shadow-md ring-1 ring-blue-50'}
             \`}>
                <div className="flex justify-between mb-1 pb-1 border-b border-gray-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Match #\${m.id}</span>
                    {m.result && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full">完賽</span>}
                </div>
                
                {/* Red Player */}
                <div className={\`flex items-center justify-between p-1 rounded-sm \${m.result?.winnerId === m.redPlayerId ? 'bg-red-50' : ''}\`}>
                    <div className="flex items-center gap-2 overflow-hidden w-full">
                        <div className={\`w-1.5 h-1.5 rounded-full shrink-0 \${m.result?.winnerId === m.redPlayerId ? 'bg-red-600' : 'bg-red-300'}\`}></div>
                        <span className={\`truncate text-xs font-medium w-full \${m.result?.winnerId === m.redPlayerId ? 'text-red-700 font-bold' : 'text-slate-600'}\`}>
                            {redName || <span className="text-slate-300 italic text-[10px]">{getWaitingLabel(m.id, 'red')}</span>}
                        </span>
                    </div>
                     {m.result && <span className="text-xs font-bold text-red-600 ml-1">{m.result.redScore}</span>}
                </div>

                {/* White Player */}
                <div className={\`flex items-center justify-between p-1 rounded-sm mt-0.5 \${m.result?.winnerId === m.whitePlayerId ? 'bg-slate-100' : ''}\`}>
                     <div className="flex items-center gap-2 overflow-hidden w-full">
                        <div className={\`w-1.5 h-1.5 rounded-full border border-gray-400 bg-white shrink-0\`}></div>
                        <span className={\`truncate text-xs font-medium w-full \${m.result?.winnerId === m.whitePlayerId ? 'text-slate-900 font-bold' : 'text-slate-600'}\`}>
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
                const roundName = isFinal ? "決賽 (Finals)" : \`Round \${idx + 1}\`;
                
                return (
                    <div key={idx} className="flex flex-col justify-around gap-4 min-w-[200px]">
                        <h3 className={\`text-center font-bold text-xs tracking-wider uppercase mb-2 sticky top-0 py-2 z-10 backdrop-blur-sm \${isFinal ? 'text-yellow-600 bg-yellow-50/90' : 'text-slate-400 bg-slate-50/90'}\`}>
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
};`,
  "App.tsx": `import React, { useState, useEffect, useRef } from 'react';
import { analyzeBracketImage } from './services/geminiService';
import { Match, Player, TournamentData, MatchResult } from './types';
import { MatchCard } from './components/MatchCard';
import { BracketTree } from './components/BracketTree';
import { Camera, Upload, Trophy, GitGraph, Save, RefreshCw, ChevronRight, Settings, ListOrdered, ArrowDownRight, User, AlertCircle, ArrowRight, Lock, Unlock, AlertTriangle, ArrowLeft, Home, Trash2, PlusCircle, PlayCircle, Medal, Download, Code, Globe } from 'lucide-react';
import JSZip from 'jszip';
import { FILES } from './sourceCode';

const App = () => {
  // --- Global State ---
  const [view, setView] = useState<'HOME' | 'EDITOR'>('HOME');
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [currentTournamentId, setCurrentTournamentId] = useState<string | null>(null);

  // --- Editor State (Derived from currentTournamentId) ---
  const [editorData, setEditorData] = useState<TournamentData | null>(null);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rankingLimit, setRankingLimit] = useState<number>(4);
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);
  const [scoreForm, setScoreForm] = useState({ red: 0, white: 0, details: '' });
  const [setupStep, setSetupStep] = useState<number>(0); 
  const [unlockedSlots, setUnlockedSlots] = useState<Record<string, boolean>>({}); 

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem('kendo-tournaments');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTournaments(parsed);
      } catch (e) {
        console.error("Failed to load tournaments", e);
      }
    }
  }, []);

  const saveToStorage = (updatedTournaments: TournamentData[]) => {
    localStorage.setItem('kendo-tournaments', JSON.stringify(updatedTournaments));
    setTournaments(updatedTournaments);
  };

  // Helper to persist a specific tournament state immediately
  const persistTournament = (data: TournamentData) => {
      const updated = { ...data, lastUpdated: Date.now() };
      
      const existingIdx = tournaments.findIndex(t => t.id === updated.id);
      let newStats = [...tournaments];
      if (existingIdx >= 0) {
          newStats[existingIdx] = updated;
      } else {
          newStats.push(updated);
      }
      saveToStorage(newStats);
      setEditorData(updated);
  };

  const createNewTournament = () => {
      const newId = \`t\${Date.now()}\`;
      const newTournament: TournamentData = {
          id: newId,
          lastUpdated: Date.now(),
          title: "新劍道比賽",
          players: [],
          matches: [],
          totalMatches: 0,
          status: 'SETUP'
      };
      setEditorData(newTournament);
      setCurrentTournamentId(newId);
      setSetupStep(0);
      setView('EDITOR');
  };

  const deleteTournament = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("確定要刪除這場比賽紀錄嗎？無法復原。")) return;
      const updated = tournaments.filter(t => t.id !== id);
      saveToStorage(updated);
  };

  const openTournament = (t: TournamentData) => {
      setEditorData(t);
      setCurrentTournamentId(t.id);
      
      // Determine step based on status/data
      if (t.status === 'SETUP') {
          if (t.matches.length > 0) setSetupStep(2);
          else if (t.players.length > 0) setSetupStep(1);
          else setSetupStep(0);
      } else {
          setSetupStep(3); // Active or Finished
      }
      setView('EDITOR');
  };

  // --- Deployment Bundler ---
  const createDeployableHtml = () => {
      // Helper to strip local imports and exports to merge files
      const processCode = (code: string) => {
          if (!code) return '';
          return code
            .replace(/import\\s+.*from\\s+['"].*['"];/g, '') // Remove local imports
            .replace(/export\\s+default\\s+/g, '') // Remove export default
            .replace(/export\\s+/g, ''); // Remove named exports
      };

      // We need to inject the FILES object roughly so the deployed app can theoretically re-download itself or use references
      // But for simplicity in the standalone HTML, we skip the sourceCode.ts logic inside the bundle to avoid massive file size doubling.
      
      const bundledScript = \`
        \${processCode(FILES['types.ts'])}
        \${processCode(FILES['services/geminiService.ts'])}
        \${processCode(FILES['components/MatchCard.tsx'])}
        \${processCode(FILES['components/BracketTree.tsx'])}
        
        // Mock FILES for the standalone app so it doesn't crash if referenced
        const FILES = {}; 

        // --- Modified App Logic for Standalone ---
        \${processCode(FILES['App.tsx'])
            .replace('downloadSourceCode', 'downloadSourceCode = () => alert("此為部署版本，無法下載原始碼")') // Disable download in deployed version
            .replace(/<button.*下載GitHub專用檔.*<\\/button>/, '') // Hide the button UI roughly
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
      \`;

      return \`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kendo Bracket Master</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
      body { font-family: 'Noto Sans TC', sans-serif; background-color: #f3f4f6; }
      .bracket-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
      .bracket-scroll::-webkit-scrollbar-track { background: #f1f1f1; }
      .bracket-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    </style>
    <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.2.0",
        "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
        "@google/genai": "https://esm.run/@google/genai", 
        "lucide-react": "https://esm.sh/lucide-react",
        "jszip": "https://esm.sh/jszip"
      }
    }
    </script>
    <script>
      // API Key Handling for Static Deploy
      window.process = { env: { API_KEY: localStorage.getItem('GEMINI_API_KEY') } };
      if (!window.process.env.API_KEY) {
        // Simple check to avoid prompt loop if user cancels
        const hasPrompted = sessionStorage.getItem('api_prompted');
        if (!hasPrompted) {
             const key = prompt("請輸入您的 Google Gemini API Key (僅儲存於本地瀏覽器):");
             if (key) {
                 localStorage.setItem('GEMINI_API_KEY', key);
                 window.process.env.API_KEY = key;
             }
             sessionStorage.setItem('api_prompted', 'true');
        }
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="text/babel" data-presets="react,typescript">
      \${bundledScript}
    </script>
  </body>
</html>\`;
  };

  const downloadSourceCode = async () => {
      try {
          const zip = new JSZip();
          
          // Generate the standalone HTML
          const deployableHtml = createDeployableHtml();
          zip.file("index.html", deployableHtml);
          
          // Generate the zip
          const blob = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(blob);
          
          // Trigger download
          const a = document.createElement('a');
          a.href = url;
          a.download = 'kendo-bracket-deploy.zip';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e) {
          console.error("Failed to generate zip", e);
          alert("打包失敗");
      }
  };

  // --- Editor Logic ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const extracted = await analyzeBracketImage(base64);
          const initialPlayers = extracted.players.map((name, idx) => ({
            id: \`p\${idx + 1}\`,
            name
          }));
          
          setEditorData(prev => prev ? ({
            ...prev,
            title: extracted.title,
            players: initialPlayers,
            totalMatches: extracted.totalMatches || 1,
            matches: [],
            status: 'SETUP'
          }) : null);
          setSetupStep(1);
        } catch (err) {
            console.error(err);
            setError("無法辨識圖片，請重試或手動輸入。");
        } finally {
            setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
        setError("讀取檔案失敗");
        setLoading(false);
    }
  };

  const initializeMatches = () => {
    if (!editorData) return;
    const newMatches: Match[] = [];
    for (let i = 1; i <= editorData.totalMatches; i++) {
      newMatches.push({
        id: i,
        redPlayerId: null,
        whitePlayerId: null,
        winnerToMatchId: null, 
        winnerToSlot: null,
        loserToMatchId: null,
        loserToSlot: null,
        result: null,
      });
    }
    setEditorData(prev => prev ? ({ ...prev, matches: newMatches }) : null);
    setSetupStep(2);
  };

  const updateMatchConfig = (id: number, field: keyof Match, value: any) => {
    setEditorData(prev => {
        if (!prev) return null;
        return {
            ...prev,
            matches: prev.matches.map(m => m.id === id ? { ...m, [field]: value } : m)
        };
    });
  };

  const startTournament = () => {
    if (!editorData) return;
    try {
        const newData = { ...editorData, status: 'ACTIVE' as const };
        persistTournament(newData);
        setSetupStep(3);
    } catch (err) {
        alert("啟動比賽時發生錯誤: " + err);
    }
  };

  // Logic helpers
  // sourceParticipants: array of player IDs involved in the source match (Winner + Loser).
  // Used to identify if the target slot contains "stale" data from the same match that needs overwriting.
  const placePlayerInMatch = (matches: Match[], targetMatchId: number, playerId: string, targetSlot: 'red' | 'white' | null, sourceParticipants: string[] = []): Match[] => {
      return matches.map(targetMatch => {
          if (targetMatch.id === targetMatchId) {
              // Explicit slot assignment (Always Overwrites)
              if (targetSlot === 'red') return { ...targetMatch, redPlayerId: playerId };
              if (targetSlot === 'white') return { ...targetMatch, whitePlayerId: playerId };
              
              // Auto-fill heuristic:
              
              // 1. Priority: If a slot currently holds one of the participants from the source match (Correction mode), overwrite it.
              if (targetMatch.redPlayerId && sourceParticipants.includes(targetMatch.redPlayerId)) {
                   return { ...targetMatch, redPlayerId: playerId };
              }
              if (targetMatch.whitePlayerId && sourceParticipants.includes(targetMatch.whitePlayerId)) {
                   return { ...targetMatch, whitePlayerId: playerId };
              }

              // 2. Normal: Fill first empty slot
              if (!targetMatch.redPlayerId) return { ...targetMatch, redPlayerId: playerId };
              if (!targetMatch.whitePlayerId) return { ...targetMatch, whitePlayerId: playerId };
              
              // 3. Fallback: If both full and no match found (shouldn't happen in normal flow), do nothing or overwrite first? 
              // Safe to return as is.
              return targetMatch; 
          }
          return targetMatch;
      });
  };

  const handleWalkover = (matchId: number) => {
      if (!editorData) return;
      if(!confirm("確定要讓此選手輪空晉級嗎？")) return;

      const match = editorData.matches.find(m => m.id === matchId);
      if (!match) return;

      const winnerId = match.redPlayerId || match.whitePlayerId;
      if (!winnerId) {
          alert("選手尚未就位，無法輪空晉級。");
          return;
      }

      const result: MatchResult = {
          redScore: 0,
          whiteScore: 0,
          details: "輪空晉級 (Walkover)",
          winnerId
      };

      const sourceParticipants = [match.redPlayerId, match.whitePlayerId].filter(Boolean) as string[];

      let updatedMatches = editorData.matches.map(m => m.id === matchId ? { ...m, result } : m);
      if (match.winnerToMatchId) {
          updatedMatches = placePlayerInMatch(updatedMatches, match.winnerToMatchId, winnerId, match.winnerToSlot, sourceParticipants);
      }
      if (match.loserToMatchId) {
          // In walkover, typically no loser action unless specified, but logically no loser exists.
      }

      // Persist immediately
      const newData = { ...editorData, matches: updatedMatches };
      persistTournament(newData);
  };

  const submitScore = () => {
    if (activeMatchId === null || !editorData) return;
    
    const match = editorData.matches.find(m => m.id === activeMatchId);
    if (!match || !match.redPlayerId || !match.whitePlayerId) return;

    let winnerId = '';
    let loserId = '';
    
    if (scoreForm.red > scoreForm.white) {
        winnerId = match.redPlayerId;
        loserId = match.whitePlayerId;
    } else if (scoreForm.white > scoreForm.red) {
        winnerId = match.whitePlayerId;
        loserId = match.redPlayerId;
    } else {
        alert("劍道比賽必須分出勝負");
        return;
    }

    const result: MatchResult = {
        redScore: scoreForm.red,
        whiteScore: scoreForm.white,
        details: scoreForm.details,
        winnerId
    };

    const sourceParticipants = [match.redPlayerId, match.whitePlayerId];

    let updatedMatches = editorData.matches.map(m => m.id === activeMatchId ? { ...m, result } : m);
    if (match.winnerToMatchId) {
        updatedMatches = placePlayerInMatch(updatedMatches, match.winnerToMatchId, winnerId, match.winnerToSlot, sourceParticipants);
    }
    if (match.loserToMatchId) {
        updatedMatches = placePlayerInMatch(updatedMatches, match.loserToMatchId, loserId, match.loserToSlot, sourceParticipants);
    }

    // Persist immediately
    const newData = { ...editorData, matches: updatedMatches };
    persistTournament(newData);
    setActiveMatchId(null);
  };

  // Ranking Logic - Refined for Championship vs Consolation Finals
  const getRankings = (limit: number) => {
      if (!editorData) return [];
      
      const rankings: {title: string, name: string, rankOrder: number}[] = [];
      const processedPlayers = new Set<string>();

      const addRanking = (pid: string | null, title: string, order: number) => {
          if (!pid) return;
          if (!processedPlayers.has(pid)) {
              const p = editorData.players.find(pl => pl.id === pid);
              if (p) {
                  rankings.push({ title, name: p.name, rankOrder: order });
                  processedPlayers.add(pid);
              }
          }
      };

      // 1. Identify all roots (matches with no defined winner destination)
      const rootMatches = editorData.matches.filter(m => !m.winnerToMatchId);

      // 2. Classify roots
      const mainRoots: Match[] = [];
      const consolationRoots: Match[] = [];

      rootMatches.forEach(root => {
          // A Consolation Root is fed by a "Loser" from ANY previous match
          // We check if any match in the tournament points its loser to this root
          const isFedByLoser = editorData.matches.some(m => m.loserToMatchId === root.id);
          if (isFedByLoser) {
              consolationRoots.push(root);
          } else {
              mainRoots.push(root);
          }
      });

      // Sort Desc to likely get higher IDs first (Match 4 vs Match 3)
      mainRoots.sort((a,b) => b.id - a.id);
      consolationRoots.sort((a,b) => b.id - a.id);

      // 3. Process Championship Roots (1st & 2nd)
      mainRoots.forEach(root => {
          if (root.result) {
              addRanking(root.result.winnerId, "冠軍 (Champion)", 1);
              const loserId = root.result.winnerId === root.redPlayerId ? root.whitePlayerId : root.redPlayerId;
              addRanking(loserId, "亞軍 (2nd Place)", 2);
          }
      });

      // 4. Process Consolation Roots (3rd & 4th)
      // These are explicit matches for 3rd place.
      consolationRoots.forEach(root => {
          if (root.result) {
               addRanking(root.result.winnerId, "季軍 (3rd Place)", 3);
               const loserId = root.result.winnerId === root.redPlayerId ? root.whitePlayerId : root.redPlayerId;
               addRanking(loserId, "殿軍 (4th Place)", 4);
          }
      });

      // 5. Implicit Rankings (Joint 3rd, Joint 5th, etc.)
      
      const getLosersOfFeeders = (targetMatchIds: number[]) => {
          return editorData.matches.filter(m => m.winnerToMatchId && targetMatchIds.includes(m.winnerToMatchId));
      };

      // Process Joint 3rd
      // If there was NO consolation match, the losers of the matches feeding the main root are Joint 3rd.
      // If there WAS a consolation match, these players would have advanced to it, so they are already handled or waiting.
      if (consolationRoots.length === 0) {
          const mainRootIds = mainRoots.map(m => m.id);
          const semiFinalMatches = getLosersOfFeeders(mainRootIds);
          semiFinalMatches.forEach(m => {
              if (m.result) {
                  const loserId = m.result.winnerId === m.redPlayerId ? m.whitePlayerId : m.redPlayerId;
                  addRanking(loserId, "季軍 (3rd Place - Joint)", 3);
              }
          });
      }

      // Process Joint 5th (Losers of Quarter-finals)
      // Logic: Find matches that fed into the Semi-Finals (which fed into Main Root)
      if (limit > 4) {
          const mainRootIds = mainRoots.map(m => m.id);
          const semiMatches = getLosersOfFeeders(mainRootIds);
          const semiIds = semiMatches.map(m => m.id);
          
          // However, if there was a consolation match, the semi-finals fed BOTH Main and Consolation.
          // The "Losers of QF" are the matches that fed into the matches that fed into the Finals.
          
          // Let's rely on Distance from Root if possible, but structure varies.
          // Safer way: Find matches feeding the Semi-Finals.
          const qfMatches = getLosersOfFeeders(semiIds);
          qfMatches.forEach(m => {
              if (m.result) {
                  const loserId = m.result.winnerId === m.redPlayerId ? m.whitePlayerId : m.redPlayerId;
                  addRanking(loserId, "第五名 (5th Place)", 5);
              }
          });
          
           // Process Joint 9th 
           if (limit > 8) {
              const qfIds = qfMatches.map(m => m.id);
              const r16Matches = getLosersOfFeeders(qfIds);
              r16Matches.forEach(m => {
                  if (m.result) {
                       const loserId = m.result.winnerId === m.redPlayerId ? m.whitePlayerId : m.redPlayerId;
                       addRanking(loserId, "第九名 (9th Place)", 9);
                  }
              });
           }
      }

      return rankings.sort((a,b) => a.rankOrder - b.rankOrder).slice(0, limit);
  };

  const getSlotSource = (matchId: number, slot: 'red' | 'white') => {
      if (!editorData) return [];
      const sources: { match: Match, type: 'winner' | 'loser' }[] = [];
      
      editorData.matches.forEach(m => {
          if (m.winnerToMatchId === matchId) {
              if (m.winnerToSlot === slot) sources.push({ match: m, type: 'winner' });
              // For 'auto', we just hint it might come here, but visually distinguish
              else if (m.winnerToSlot === null) sources.push({ match: m, type: 'winner' }); 
          }
          if (m.loserToMatchId === matchId) {
              if (m.loserToSlot === slot) sources.push({ match: m, type: 'loser' });
              else if (m.loserToSlot === null) sources.push({ match: m, type: 'loser' });
          }
      });
      return sources;
  };

  const getIncomingSources = (matchId: number) => {
     if (!editorData) return { red: 0, white: 0 };
     const sources = { red: 0, white: 0 };
     editorData.matches.forEach(m => {
         // Check Winner path
         if (m.winnerToMatchId === matchId) {
             if (m.winnerToSlot === 'red') sources.red++;
             else if (m.winnerToSlot === 'white') sources.white++;
             else { sources.red++; sources.white++; } // Count as potential for both
         }
         // Check Loser path
         if (m.loserToMatchId === matchId) {
             if (m.loserToSlot === 'red') sources.red++;
             else if (m.loserToSlot === 'white') sources.white++;
             else { sources.red++; sources.white++; }
         }
     });
     return sources;
  }

  // --- Render Steps ---

  const renderHome = () => (
      <div className="max-w-4xl mx-auto p-6">
          <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                  <Trophy className="w-8 h-8 text-yellow-500" />
                  Kendo Bracket Master
              </h1>
              <div className="flex gap-2">
                  <button onClick={downloadSourceCode} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border border-transparent px-4 py-2 rounded-lg hover:shadow-lg hover:scale-105 transition shadow-sm font-bold">
                      <Globe className="w-5 h-5" />
                      下載 GitHub 專用檔 (Ready to Deploy)
                  </button>
                  <button onClick={createNewTournament} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition shadow-sm">
                      <PlusCircle className="w-5 h-5" />
                      建立新比賽
                  </button>
              </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tournaments.length === 0 && (
                  <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                      <p className="text-slate-400">尚無比賽紀錄</p>
                  </div>
              )}
              {tournaments.sort((a,b) => b.lastUpdated - a.lastUpdated).map(t => (
                  <div key={t.id} onClick={() => openTournament(t)} className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition group relative">
                       <div className="flex justify-between items-start mb-2">
                           <h3 className="font-bold text-lg text-slate-800 line-clamp-1">{t.title}</h3>
                           <span className={\`text-xs px-2 py-1 rounded-full \${t.status === 'FINISHED' ? 'bg-green-100 text-green-700' : t.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}\`}>
                               {t.status === 'FINISHED' ? '已結束' : t.status === 'ACTIVE' ? '進行中' : '設定中'}
                           </span>
                       </div>
                       <p className="text-sm text-slate-500 mb-4">
                           {t.totalMatches} 場比賽 • {t.players.length} 位選手
                       </p>
                       <div className="text-xs text-slate-400 flex justify-between items-center">
                           <span>更新於 {new Date(t.lastUpdated).toLocaleDateString()}</span>
                           <PlayCircle className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                       </div>
                       <button onClick={(e) => deleteTournament(t.id, e)} className="absolute bottom-4 right-12 p-1 text-slate-300 hover:text-red-500 transition">
                           <Trash2 className="w-4 h-4" />
                       </button>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderSetupStep0 = () => (
    <div className="max-w-xl mx-auto mt-10 p-8 bg-white rounded-2xl shadow-sm border border-slate-100 text-center">
      <div className="mb-6 flex justify-center">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
             <Camera className="w-8 h-8 text-blue-600" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">上傳賽程表圖片</h2>
      <p className="text-slate-500 mb-8">
        系統將自動辨識比賽名稱、選手名單與場次數量。<br/>
        支援直式中文姓名辨識。
      </p>
      
      <div className="space-y-4">
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="w-full py-4 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50"
        >
          {loading ? <RefreshCw className="animate-spin" /> : <Upload />}
          {loading ? "分析中..." : "選擇圖片"}
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          onChange={handleFileUpload}
        />
        
        <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">或</span></div>
        </div>

        <button 
            onClick={() => {
                 setEditorData(prev => prev ? ({ ...prev, matches: [], players: [], totalMatches: 1 }) : null);
                 setSetupStep(1);
            }}
            className="w-full py-3 px-6 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all"
        >
            手動輸入資料
        </button>
      </div>
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center justify-center gap-2">
           <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
    </div>
  );

  const renderSetupStep1 = () => (
    <div className="max-w-2xl mx-auto mt-8 p-6 bg-white rounded-xl shadow-sm border border-slate-100">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <ListOrdered className="w-6 h-6 text-blue-600" />
        確認比賽資訊
      </h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">比賽名稱</label>
          <input 
            value={editorData?.title || ''}
            onChange={(e) => setEditorData(prev => prev ? ({...prev, title: e.target.value}) : null)}
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">總場次數量 (Matches)</label>
          <input 
            type="number"
            value={editorData?.totalMatches || 0}
            onChange={(e) => setEditorData(prev => prev ? ({...prev, totalMatches: parseInt(e.target.value) || 0}) : null)}
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">參賽選手名單 ({editorData?.players.length} 位)</label>
          <textarea
            value={editorData?.players.map(p => p.name).join('\\n') || ''}
            onChange={(e) => {
              const names = e.target.value.split('\\n').filter(n => n.trim());
              setEditorData(prev => prev ? ({
                ...prev,
                players: names.map((n, i) => ({ id: \`p\${i+1}\`, name: n.trim() }))
              }) : null);
            }}
            className="w-full h-48 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
            placeholder="一行一位選手..."
          />
        </div>

        <button 
          onClick={initializeMatches}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2"
        >
          下一步：設定賽程結構 <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const renderSetupStep2 = () => {
      const activeMatchCount = editorData?.matches.length || 0;
      const rootMatches = editorData?.matches.filter(m => !m.winnerToMatchId) || [];
      const validationWarning = rootMatches.length > 1;

      return (
    <div className="max-w-5xl mx-auto mt-6">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GitGraph className="w-6 h-6 text-blue-600" />
            設定賽程關聯
          </h2>
          <div className="flex items-center gap-2">
              {validationWarning && (
                  <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      注意：有 {rootMatches.length} 場比賽沒有後續 (決賽應只有1場)
                  </span>
              )}
              <button 
                onClick={startTournament}
                className="py-2 px-6 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-2"
              >
                <PlayCircle className="w-5 h-5" />
                開始比賽
              </button>
          </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
        {editorData?.matches.map(match => {
            const redSources = getSlotSource(match.id, 'red');
            const whiteSources = getSlotSource(match.id, 'white');

            // Determine if dropdowns should be locked
            const isRedLocked = redSources.length > 0 && !unlockedSlots[\`\${match.id}-red\`];
            const isWhiteLocked = whiteSources.length > 0 && !unlockedSlots[\`\${match.id}-white\`];

            return (
          <div key={match.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group hover:border-blue-400 transition">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-50">
                <span className="font-bold text-slate-600">Match #{match.id}</span>
                {(!match.winnerToMatchId) ? (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">決賽 / Root</span>
                ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">To #{match.winnerToMatchId}</span>
                )}
            </div>

            {/* Players Selection */}
            <div className="space-y-3 mb-4">
                {/* Red Slot */}
                <div className="relative">
                    <label className="text-xs font-bold text-red-700 mb-1 block flex justify-between">
                        紅方 (Red)
                        {isRedLocked && (
                             <button onClick={() => setUnlockedSlots(prev => ({...prev, [\`\${match.id}-red\`]: true}))} className="text-gray-300 hover:text-gray-500">
                                 <Lock className="w-3 h-3" />
                             </button>
                        )}
                        {!isRedLocked && redSources.length > 0 && (
                            <button onClick={() => setUnlockedSlots(prev => ({...prev, [\`\${match.id}-red\`]: false}))} className="text-gray-300 hover:text-gray-500">
                                 <Unlock className="w-3 h-3" />
                            </button>
                        )}
                    </label>
                    {isRedLocked ? (
                        <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500 italic flex flex-col">
                           {redSources.map((s, idx) => (
                               <span key={idx}>From Match #{s.match.id} ({s.type === 'winner' ? 'Winner' : 'Loser'})</span>
                           ))}
                        </div>
                    ) : (
                        <select 
                            value={match.redPlayerId || ''}
                            onChange={(e) => updateMatchConfig(match.id, 'redPlayerId', e.target.value || null)}
                            className="w-full p-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-red-500 outline-none"
                        >
                            <option value="">(Waiting / Empty)</option>
                            {editorData?.players.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* White Slot */}
                <div className="relative">
                     <label className="text-xs font-bold text-slate-700 mb-1 block flex justify-between">
                        白方 (White)
                        {isWhiteLocked && (
                             <button onClick={() => setUnlockedSlots(prev => ({...prev, [\`\${match.id}-white\`]: true}))} className="text-gray-300 hover:text-gray-500">
                                 <Lock className="w-3 h-3" />
                             </button>
                        )}
                        {!isWhiteLocked && whiteSources.length > 0 && (
                            <button onClick={() => setUnlockedSlots(prev => ({...prev, [\`\${match.id}-white\`]: false}))} className="text-gray-300 hover:text-gray-500">
                                 <Unlock className="w-3 h-3" />
                            </button>
                        )}
                    </label>
                    {isWhiteLocked ? (
                        <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500 italic flex flex-col">
                           {whiteSources.map((s, idx) => (
                               <span key={idx}>From Match #{s.match.id} ({s.type === 'winner' ? 'Winner' : 'Loser'})</span>
                           ))}
                        </div>
                    ) : (
                        <select 
                            value={match.whitePlayerId || ''}
                            onChange={(e) => updateMatchConfig(match.id, 'whitePlayerId', e.target.value || null)}
                            className="w-full p-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                            <option value="">(Waiting / Empty)</option>
                            {editorData?.players.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Next Match Selection */}
            <div className="mt-3 pt-3 border-t border-gray-50 bg-slate-50/50 p-2 rounded">
                 <div className="flex flex-col gap-2">
                    <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">勝者去 (Winner to)</label>
                        <div className="flex gap-1">
                            <select 
                                value={match.winnerToMatchId || ''}
                                onChange={(e) => updateMatchConfig(match.id, 'winnerToMatchId', parseInt(e.target.value) || null)}
                                className="w-full p-1 text-xs border border-slate-200 rounded outline-none"
                            >
                                <option value="">(決賽/結束)</option>
                                {editorData?.matches.filter(m => m.id !== match.id).map(m => (
                                    <option key={m.id} value={m.id}>Match #{m.id}</option>
                                ))}
                            </select>
                            <select
                                value={match.winnerToSlot || ''}
                                onChange={(e) => updateMatchConfig(match.id, 'winnerToSlot', e.target.value || null)}
                                className="w-20 p-1 text-xs border border-slate-200 rounded outline-none"
                            >
                                <option value="">Auto</option>
                                <option value="red">Red</option>
                                <option value="white">White</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 block mb-1">敗者去 (Loser to)</label>
                        <div className="flex gap-1">
                             <select 
                                value={match.loserToMatchId || ''}
                                onChange={(e) => updateMatchConfig(match.id, 'loserToMatchId', parseInt(e.target.value) || null)}
                                className="w-full p-1 text-xs border border-slate-200 rounded outline-none bg-white text-slate-500"
                            >
                                <option value="">(淘汰)</option>
                                {editorData?.matches.filter(m => m.id !== match.id).map(m => (
                                    <option key={m.id} value={m.id}>Match #{m.id}</option>
                                ))}
                            </select>
                            <select
                                value={match.loserToSlot || ''}
                                onChange={(e) => updateMatchConfig(match.id, 'loserToSlot', e.target.value || null)}
                                className="w-20 p-1 text-xs border border-slate-200 rounded outline-none text-slate-500"
                            >
                                <option value="">Auto</option>
                                <option value="red">Red</option>
                                <option value="white">White</option>
                            </select>
                        </div>
                    </div>
                 </div>
            </div>
          </div>
            );
        })}
      </div>
    </div>
  );
  };

  const renderActiveTournament = () => {
    const finishedCount = editorData?.matches.filter(m => m.result).length || 0;
    const totalCount = editorData?.matches.length || 0;
    const isComplete = finishedCount === totalCount && totalCount > 0;
    
    // Sort logic for list view: Unfinished first, then by ID
    const sortedMatches = [...(editorData?.matches || [])].sort((a, b) => {
        if (!!a.result === !!b.result) return a.id - b.id;
        return a.result ? 1 : -1;
    });

    return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden max-w-[1920px] mx-auto">
      {/* Sidebar: Match List */}
      <div className="w-full md:w-96 bg-white border-r border-slate-200 flex flex-col h-full z-10 shadow-xl">
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-2">
             <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                賽程表
             </h2>
             <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
                {finishedCount}/{totalCount}
             </span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
             <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: \`\${(finishedCount/totalCount)*100}%\` }}></div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {sortedMatches.map(match => (
            <MatchCard 
              key={match.id} 
              match={match} 
              players={editorData?.players || []}
              onScore={(id) => {
                  setActiveMatchId(id);
                  setScoreForm({ red: 0, white: 0, details: '' });
              }}
              onWalkover={handleWalkover}
              highlight={activeMatchId === match.id}
              sourceCount={getIncomingSources(match.id).red + getIncomingSources(match.id).white}
              redSourceExist={getIncomingSources(match.id).red > 0}
              whiteSourceExist={getIncomingSources(match.id).white > 0}
            />
          ))}
        </div>
        
        {isComplete && (
            <div className="p-4 border-t border-slate-200 bg-green-50 animate-pulse">
                <button 
                    onClick={() => setSetupStep(4)}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transform hover:scale-105 transition flex items-center justify-center gap-2"
                >
                    <Medal className="w-5 h-5" />
                    查看最終結果
                </button>
            </div>
        )}
      </div>

      {/* Main Area: Bracket Tree */}
      <div className="flex-1 bg-slate-100 relative overflow-hidden flex flex-col">
          <div className="absolute top-4 right-4 z-20 flex gap-2">
               <button onClick={() => setSetupStep(2)} className="bg-white p-2 rounded shadow text-slate-500 hover:text-blue-600 border border-slate-200" title="回到設定">
                   <Settings className="w-5 h-5" />
               </button>
          </div>
          <BracketTree 
            matches={editorData?.matches || []} 
            players={editorData?.players || []}
            rootMatchId={editorData?.totalMatches || 0}
          />
      </div>

      {/* Score Modal */}
      {activeMatchId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
            <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                <h3 className="font-bold text-lg">紀錄比分 - Match #{activeMatchId}</h3>
                <button onClick={() => setActiveMatchId(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <div className="p-6">
               <div className="flex items-center justify-between mb-8 gap-4">
                   {/* Red Input */}
                   <div className="text-center flex-1">
                       <div className="text-xs font-bold text-red-600 mb-2 uppercase tracking-wider">Red Player</div>
                       <input 
                         type="number" 
                         min="0"
                         value={scoreForm.red}
                         onChange={(e) => setScoreForm(s => ({...s, red: parseInt(e.target.value) || 0}))}
                         className="w-full text-center text-4xl font-black p-4 border-2 border-red-100 rounded-xl focus:border-red-500 outline-none bg-red-50 text-red-900"
                       />
                   </div>
                   <div className="text-2xl font-black text-slate-300">
                       :
                   </div>
                   {/* White Input */}
                   <div className="text-center flex-1">
                       <div className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">White Player</div>
                       <input 
                         type="number" 
                         min="0"
                         value={scoreForm.white}
                         onChange={(e) => setScoreForm(s => ({...s, white: parseInt(e.target.value) || 0}))}
                         className="w-full text-center text-4xl font-black p-4 border-2 border-slate-200 rounded-xl focus:border-slate-500 outline-none bg-slate-50 text-slate-900"
                       />
                   </div>
               </div>

               <div className="mb-6">
                   <label className="block text-sm font-medium text-slate-600 mb-2">勝負細節 (例如: 面, 手)</label>
                   <input 
                     type="text"
                     value={scoreForm.details}
                     onChange={(e) => setScoreForm(s => ({...s, details: e.target.value}))}
                     className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                     placeholder="輸入得分部位..."
                   />
               </div>

               <button 
                 onClick={submitScore}
                 className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-lg transform active:scale-[0.98] transition-all"
               >
                   確認送出
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  };

  const renderRankings = () => {
      const rankings = getRankings(rankingLimit);

      return (
          <div className="max-w-2xl mx-auto mt-10 p-8 bg-white rounded-2xl shadow-xl border border-slate-100 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400"></div>
              
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 drop-shadow-sm" />
              <h2 className="text-3xl font-black text-slate-800 mb-2">最終排名</h2>
              <p className="text-slate-500 mb-8 font-medium">Tournament Results</p>

              <div className="flex justify-center gap-2 mb-6">
                  {[4, 8].map(n => (
                      <button 
                        key={n}
                        onClick={() => setRankingLimit(n)}
                        className={\`px-3 py-1 text-xs rounded-full border \${rankingLimit === n ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-500 border-slate-200 hover:bg-slate-50'}\`}
                      >
                          Top {n}
                      </button>
                  ))}
              </div>
              
              <div className="space-y-3 text-left">
                  {rankings.map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-yellow-200 transition group">
                          <div className="flex items-center gap-4">
                              <div className={\`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm
                                \${r.rankOrder === 1 ? 'bg-yellow-100 text-yellow-700' : 
                                  r.rankOrder === 2 ? 'bg-gray-200 text-gray-700' : 
                                  r.rankOrder === 3 ? 'bg-orange-100 text-orange-800' : 'bg-white border border-slate-200 text-slate-500'}
                              \`}>
                                  {r.rankOrder}
                              </div>
                              <div>
                                  <div className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition">{r.name}</div>
                                  <div className="text-xs text-slate-400 uppercase tracking-wide font-medium">{r.title}</div>
                              </div>
                          </div>
                          {r.rankOrder === 1 && <Trophy className="w-5 h-5 text-yellow-500" />}
                      </div>
                  ))}
                  {rankings.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                          尚未產生排名結果
                      </div>
                  )}
              </div>

              <button 
                onClick={() => setSetupStep(3)}
                className="mt-8 px-6 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition text-sm flex items-center justify-center gap-2 mx-auto"
              >
                  <ArrowLeft className="w-4 h-4" /> 返回賽程表
              </button>
          </div>
      )
  }

  // --- Main Layout ---

  if (view === 'HOME') {
      return renderHome();
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
             <button onClick={() => setView('HOME')} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
                 <Home className="w-5 h-5" />
             </button>
             <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span className="bg-slate-800 text-white p-1 rounded"><Trophy className="w-4 h-4" /></span>
                {editorData?.title || 'Kendo Bracket Master'}
             </h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
            {['上傳/設定', '確認資訊', '賽程結構', '進行比賽', '最終排名'].map((step, idx) => (
                <div key={idx} className={\`flex items-center gap-2 \${setupStep >= idx ? 'text-blue-600 font-medium' : 'text-slate-300'}\`}>
                    <span className={\`w-6 h-6 rounded-full flex items-center justify-center text-xs \${setupStep >= idx ? 'bg-blue-100' : 'border border-slate-200'}\`}>
                        {idx + 1}
                    </span>
                    <span className="hidden md:inline">{step}</span>
                    {idx < 4 && <ChevronRight className="w-4 h-4 text-slate-200" />}
                </div>
            ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {setupStep === 0 && renderSetupStep0()}
        {setupStep === 1 && renderSetupStep1()}
        {setupStep === 2 && renderSetupStep2()}
        {setupStep === 3 && renderActiveTournament()}
        {setupStep === 4 && renderRankings()}
      </main>
    </div>
  );
};

export default App;`
};
