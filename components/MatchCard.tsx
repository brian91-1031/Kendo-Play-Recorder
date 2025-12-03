
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
      className={`relative border rounded-xl p-4 shadow-sm bg-white flex flex-col gap-3 transition-all duration-300 hover:shadow-md
      ${highlight ? 'ring-2 ring-blue-500' : ''} 
      ${isFinished ? 'bg-gray-50/80' : 'border-slate-200'}
      `}
    >
      <div className="flex justify-between items-center text-xs font-bold border-b border-gray-100 pb-2 mb-1">
        <span className="text-slate-400">MATCH #${match.id}</span>
        {match.result && <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full">已完賽</span>}
        {!match.result && isReady && <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">進行中</span>}
        {!match.result && isBye && <span className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">輪空待命</span>}
      </div>

      <div className="flex justify-between items-center gap-2">
        {/* Red Side */}
        <div className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${match.result?.winnerId === match.redPlayerId ? 'bg-red-50 ring-1 ring-red-100' : ''}`}>
          <div className="w-full h-1 bg-red-500 mb-2 rounded-full opacity-80"></div>
          <span className={`font-medium text-sm text-center break-all line-clamp-2 min-h-[2.5em] flex items-center ${match.result?.winnerId === match.redPlayerId ? 'text-red-700 font-bold' : 'text-slate-700'}`}>
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
        <div className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${match.result?.winnerId === match.whitePlayerId ? 'bg-gray-100 ring-1 ring-gray-200' : ''}`}>
          <div className="w-full h-1 bg-white border border-gray-300 mb-2 rounded-full"></div>
          <span className={`font-medium text-sm text-center break-all line-clamp-2 min-h-[2.5em] flex items-center ${match.result?.winnerId === match.whitePlayerId ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
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
};