import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  RotateCcw,
  Undo2,
  Trophy,
  Star,
  Sparkles,
  Zap,
  ShieldCheck,
  Clock,
  Lock,
  Play,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// --- Game Configurations ---
const ALL_COLORS = [
  "from-rose-400 to-rose-600 shadow-rose-500",
  "from-blue-400 to-blue-600 shadow-blue-500",
  "from-emerald-400 to-emerald-600 shadow-emerald-500",
  "from-amber-300 to-amber-500 shadow-amber-400",
  "from-purple-400 to-purple-600 shadow-purple-500",
  "from-cyan-300 to-cyan-500 shadow-cyan-400",
  "from-pink-400 to-pink-600 shadow-pink-500",
  "from-indigo-400 to-indigo-600 shadow-indigo-500",
  "from-lime-400 to-lime-600 shadow-lime-500",
];

const TUBE_CAPACITY = 4;

export default function AuraSort() {
  // --- Progression State ---
  const [level, setLevel] = useState(1);
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [profile, setProfile] = useState({ gamesWon: 0, totalMoves: 0 });

  // --- Game State ---
  const [gameState, setGameState] = useState<
    "MENU" | "PLAYING" | "WON" | "LOST"
  >("MENU");
  const [timeLeft, setTimeLeft] = useState(60);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  const [tubes, setTubes] = useState<string[][]>([]);
  const [selectedTube, setSelectedTube] = useState<number | null>(null);
  const [shakeTube, setShakeTube] = useState<number | null>(null);
  const [history, setHistory] = useState<string[][][]>([]);
  const [moves, setMoves] = useState(0);

  // Load profile
  useEffect(() => {
    const saved = localStorage.getItem("auraSortProfile");
    const savedLevel = localStorage.getItem("auraSortLevel");
    const savedUnlocked = localStorage.getItem("auraSortUnlocked");
    if (saved) setProfile(JSON.parse(saved));
    if (savedLevel) setLevel(parseInt(savedLevel));
    if (savedUnlocked) setMaxUnlockedLevel(parseInt(savedUnlocked));
  }, []);

  const saveProgress = (newLevel: number, won: boolean, moveCount: number) => {
    setLevel(newLevel);
    localStorage.setItem("auraSortLevel", newLevel.toString());
    if (won) {
      const newUnlocked = Math.max(maxUnlockedLevel, newLevel);
      setMaxUnlockedLevel(newUnlocked);
      localStorage.setItem("auraSortUnlocked", newUnlocked.toString());
      const newProf = {
        gamesWon: profile.gamesWon + 1,
        totalMoves: profile.totalMoves + moveCount,
      };
      setProfile(newProf);
      localStorage.setItem("auraSortProfile", JSON.stringify(newProf));
    }
  };

  // --- Music Generation ---
  const toggleMusic = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (
        window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      )();
    }

    if (isMusicPlaying) {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      setIsMusicPlaying(false);
    } else {
      const osc = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, audioContextRef.current.currentTime);
      osc.frequency.linearRampToValueAtTime(
        300,
        audioContextRef.current.currentTime + 10,
      );

      gainNode.gain.setValueAtTime(0.05, audioContextRef.current.currentTime);

      osc.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      osc.start();
      oscillatorRef.current = osc;
      setIsMusicPlaying(true);
    }
  };

  useEffect(() => {
    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
      }
    };
  }, []);

  // --- Timer Logic ---
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === "PLAYING" && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameState("LOST");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  // --- Level Generation ---
  // We strictly use 4 bottles (3 full, 1 empty) exactly as requested.
  // To ensure the puzzle is always solvable and difficulty scales, we use a "Reverse Shuffle" generator.
  const generateLevel = (targetLevel: number) => {
    const colorCount = 3; // Exactly 3 filled tubes
    const emptyCount = 1; // Exactly 1 empty tube
    const totalTubes = colorCount + emptyCount;

    // Pick 3 random distinct colors for this level
    const shuffledColors = [...ALL_COLORS].sort(() => Math.random() - 0.5);
    const activeColors = shuffledColors.slice(0, colorCount);

    // 1. Start with a completely SOLVED state
    const scaffoldTubes: string[][] = [];
    for (let i = 0; i < colorCount; i++) {
      scaffoldTubes.push(Array(TUBE_CAPACITY).fill(activeColors[i]));
    }
    for (let i = 0; i < emptyCount; i++) {
      scaffoldTubes.push([]);
    }

    // 2. Reverse Shuffle!
    // Moving backward from solved state guarantees it is 100% solvable.
    // Higher levels = more reverse shuffles = harder puzzle!
    const shuffleMoves = 20 + Math.min(targetLevel * 4, 100);

    let lastSource = -1;
    let lastTarget = -1;

    for (let step = 0; step < shuffleMoves; step++) {
      // Find all legal reverse moves
      const validReverseMoves: { from: number; to: number }[] = [];

      for (let b = 0; b < totalTubes; b++) {
        if (scaffoldTubes[b].length === 0) continue; // Tube is empty, nothing to pull from

        const ball = scaffoldTubes[b][scaffoldTubes[b].length - 1];

        // In reverse, a move is legal if the tube we take FROM would have naturally accepted this ball in forward time.
        // It accepts it if it becomes empty, OR if the new top matches the ball's color.
        const isLegalReverse =
          scaffoldTubes[b].length === 1 ||
          scaffoldTubes[b][scaffoldTubes[b].length - 2] === ball;

        if (isLegalReverse) {
          for (let a = 0; a < totalTubes; a++) {
            if (a === b) continue;
            // The tube we move TO in reverse just needs space (since in forward time, the ball leaves it)
            if (scaffoldTubes[a].length < TUBE_CAPACITY) {
              // Prevent exact immediate undo loops for better shuffling
              if (!(b === lastTarget && a === lastSource)) {
                validReverseMoves.push({ from: b, to: a });
              }
            }
          }
        }
      }

      if (validReverseMoves.length === 0) break; // Safety fallback

      // Execute a random legal reverse move
      const move =
        validReverseMoves[Math.floor(Math.random() * validReverseMoves.length)];
      const popped = scaffoldTubes[move.from].pop()!;
      scaffoldTubes[move.to].push(popped);

      lastSource = move.from;
      lastTarget = move.to;
    }

    setTubes(scaffoldTubes);
    setSelectedTube(null);
    setHistory([]);
    setMoves(0);
    setTimeLeft(60);
    setGameState("PLAYING");
  };

  const startNextLevel = () => generateLevel(level);

  const selectLevelToPlay = (lvl: number) => {
    setLevel(lvl);
    generateLevel(lvl);
  };

  const restartLevel = () => {
    if (history.length > 0) {
      setTubes(history[0]);
      setHistory([]);
      setMoves(0);
      setSelectedTube(null);
    } else {
      generateLevel(level); // Just re-roll
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setTubes(prev);
    setHistory(history.slice(0, -1));
    setMoves((m) => Math.max(0, m - 1));
    setSelectedTube(null);
  };

  // --- Interaction Logic ---
  const handleTubeClick = (tubeIndex: number) => {
    if (gameState !== "PLAYING") return;

    if (selectedTube === null) {
      // Select a tube if it's not empty and not already fully solved
      if (tubes[tubeIndex].length > 0 && !isTubeSolved(tubes[tubeIndex])) {
        setSelectedTube(tubeIndex);
      }
    } else {
      // Deselect if clicking the same tube
      if (selectedTube === tubeIndex) {
        setSelectedTube(null);
        return;
      }

      // Try to move
      const sourceTube = tubes[selectedTube];
      const targetTube = tubes[tubeIndex];

      const topSourceBall = sourceTube[sourceTube.length - 1];
      const topTargetBall =
        targetTube.length > 0 ? targetTube[targetTube.length - 1] : null;

      // The user wants to be able to place ANY ball into ANY bottle that has space,
      // regardless of matching colors, to improve the game flow heavily.
      const canMove = targetTube.length < TUBE_CAPACITY;

      if (canMove) {
        // Save history
        setHistory([...history, JSON.parse(JSON.stringify(tubes))]);

        const newTubes = [...tubes];
        newTubes[selectedTube] = [...sourceTube];
        newTubes[tubeIndex] = [...targetTube];

        const ballToMove = newTubes[selectedTube].pop()!;
        newTubes[tubeIndex].push(ballToMove);

        setTubes(newTubes);
        setMoves((m) => m + 1);
        setSelectedTube(null);
      } else {
        // Target is full, so just shake it to show it's full and clear selection
        setShakeTube(tubeIndex);
        setTimeout(() => setShakeTube(null), 500); // Visual feedback
        setSelectedTube(null); // Invalid drop point, reset
      }
    }
  };

  const isTubeSolved = (tube: string[]) => {
    if (tube.length === 0) return true;
    if (tube.length < TUBE_CAPACITY) return false;
    const firstCol = tube[0];
    return tube.every((ball) => ball === firstCol);
  };

  // --- Check Win Condition ---
  useEffect(() => {
    if (gameState === "PLAYING" && tubes.length > 0) {
      const allSolved = tubes.every((t) => isTubeSolved(t));
      if (allSolved) {
        setGameState("WON");
        const bonus = Math.max(100, 1000 - moves * 10);
        setScore((s) => s + bonus);
        saveProgress(level + 1, true, moves);
      }
    }
  }, [tubes, gameState]);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#060913] relative flex flex-col font-sans overflow-x-hidden selection:bg-blue-500/30">
        {/* Modern ambient animated background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-blue-900/10 blur-[100px] animate-pulse"
            style={{ animationDuration: "8s" }}
          />
          <div
            className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-purple-900/10 blur-[100px] animate-pulse"
            style={{ animationDuration: "10s" }}
          />
        </div>

        {/* Global Header */}
        <div className="relative z-20 w-full p-4 sm:p-6 pb-0 flex flex-col items-center">
          <div className="w-full max-w-5xl flex justify-between items-center bg-white/5 backdrop-blur-xl p-3 sm:px-6 rounded-2xl border border-white/10 shadow-2xl">
            <Link
              to="/gaming"
              className="flex items-center gap-2 text-white/50 hover:text-white font-semibold text-sm transition-colors py-2 px-3 sm:px-4 bg-white/5 rounded-xl hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4" />{" "}
              <span className="hidden sm:inline">Hub</span>
            </Link>

            <div className="flex gap-4 sm:gap-12 items-center flex-1 justify-center">
              <div className="text-center">
                <p className="text-[10px] sm:text-xs text-white/40 uppercase tracking-widest font-bold mb-0.5">
                  Stage
                </p>
                <p className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                  {level}
                </p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center min-w-[60px]">
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-0.5">
                  Time
                </p>
                <p
                  className={`text-xl font-black ${timeLeft <= 10 && gameState === "PLAYING" ? "text-rose-500 animate-pulse" : "text-white"}`}
                >
                  {timeLeft}s
                </p>
              </div>
              <div className="w-px h-8 bg-white/10 hidden sm:block" />
              <div className="text-center hidden sm:block">
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-0.5">
                  Score
                </p>
                <p className="text-xl font-black text-amber-400">
                  {score.toLocaleString()}
                </p>
              </div>
              <div className="w-px h-8 bg-white/10 hidden sm:block" />
              <div className="text-center min-w-[60px]">
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-0.5">
                  Moves
                </p>
                <p className="text-xl font-black text-white">{moves}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-black/30 px-4 py-2 rounded-xl border border-white/5">
              <button
                onClick={toggleMusic}
                className="text-white/60 hover:text-white transition-colors p-2 hidden sm:block"
              >
                {isMusicPlaying ? (
                  <Volume2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </button>
              <Trophy className="w-5 h-5 text-yellow-400 ml-0 sm:ml-2" />
              <div className="text-left hidden sm:block">
                <p className="text-[10px] text-white/40 uppercase font-bold leading-tight">
                  Victories
                </p>
                <p className="text-sm font-bold text-white leading-tight">
                  {profile.gamesWon}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col items-center justify-center relative z-10 p-4 pt-10">
          {gameState === "MENU" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-2xl p-8 sm:p-12 rounded-[2rem] border border-white/10 shadow-2xl text-center max-w-4xl w-full"
            >
              <h1 className="text-5xl sm:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-lg">
                AURA{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                  SORT
                </span>
              </h1>
              <p className="text-white/60 mb-10 text-lg leading-relaxed max-w-2xl mx-auto">
                Sort the glowing orbs by color! Complete each stage in under{" "}
                <strong className="text-white">60 seconds</strong> to unlock the
                next. Can you beat all 50 stages?
              </p>

              <div className="grid grid-cols-5 sm:grid-cols-8 gap-3 sm:gap-4 mb-8 max-h-[45vh] overflow-y-auto p-4 custom-scrollbar bg-black/20 rounded-3xl border border-white/5 shadow-inner">
                {Array.from({ length: 50 }).map((_, i) => {
                  const st = i + 1;
                  const isUnlocked = st <= maxUnlockedLevel;
                  const isCurrent = st === maxUnlockedLevel;
                  const isCompleted = st < maxUnlockedLevel;

                  return (
                    <button
                      key={st}
                      disabled={!isUnlocked}
                      onClick={() => selectLevelToPlay(st)}
                      className={`relative w-full pb-[100%] rounded-2xl font-black text-xl transition-all overflow-hidden group ${isUnlocked ? "cursor-pointer hover:scale-110 hover:-translate-y-1 hover:z-10" : "cursor-not-allowed opacity-80 scale-95"}`}
                    >
                      <div
                        className={`absolute inset-0 flex flex-col items-center justify-center border-2 shadow-lg backdrop-blur-sm ${isCompleted ? "bg-gradient-to-br from-emerald-600/40 to-teal-900/60 border-emerald-400/40" : isCurrent ? "bg-gradient-to-br from-blue-500/50 to-purple-600/50 border-blue-400/60 shadow-[0_0_25px_rgba(59,130,246,0.4)]" : "bg-black/60 border-white/5"} rounded-2xl transition-all duration-300 group-hover:shadow-[0_0_25px_rgba(255,255,255,0.3)]`}
                      >
                        {/* Background flare for unlocked */}
                        {isUnlocked && (
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent duration-500" />
                        )}

                        {/* Content */}
                        {isCompleted ? (
                          <>
                            <span className="text-white drop-shadow-md z-10 text-2xl">
                              {st}
                            </span>
                            <div className="flex gap-px mt-1 z-10 scale-90">
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            </div>
                          </>
                        ) : isCurrent ? (
                          <>
                            <div className="absolute top-0 right-0 w-10 h-10 bg-blue-400 blur-xl opacity-60 animate-pulse" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-blue-200 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] z-10 text-3xl">
                              {st}
                            </span>
                            <div className="absolute -bottom-1 w-1/2 h-1 bg-blue-400 rounded-t-lg opacity-80" />
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1 z-10">
                            <div className="w-10 h-10 bg-black/40 rounded-full flex items-center justify-center border border-white/5 mb-1 text-white/20 shadow-inner">
                              <Lock className="w-5 h-5" />
                            </div>
                            <span className="text-white/20 text-xs font-bold tracking-widest">
                              LOCKED
                            </span>
                          </div>
                        )}

                        {/* Inner Glass border */}
                        <div className="absolute inset-0 rounded-2xl border border-white/10 z-0 pointer-events-none" />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => selectLevelToPlay(level)}
                  className="w-full max-w-xs py-8 text-xl font-bold uppercase tracking-widest bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all hover:scale-[1.03] flex items-center justify-center"
                >
                  <Play className="mr-3 w-6 h-6 fill-white" /> Continue
                </Button>
              </div>
            </motion.div>
          )}

          {gameState === "PLAYING" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full flex-1 flex flex-col items-center"
            >
              {/* Toolbar */}
              <div className="w-full max-w-lg flex justify-between gap-4 mb-8 sm:mb-12">
                <Button
                  variant="outline"
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-white/5 py-6 rounded-xl"
                >
                  <Undo2 className="mr-2 w-5 h-5" /> Undo
                </Button>
                <Button
                  variant="outline"
                  onClick={restartLevel}
                  className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-white py-6 rounded-xl"
                >
                  <RotateCcw className="mr-2 w-5 h-5" /> Restart
                </Button>
              </div>

              {/* Tubes Grid */}
              <div className="flex flex-wrap justify-center gap-x-8 gap-y-12 sm:gap-x-12 sm:gap-y-16 max-w-2xl px-2">
                {tubes.map((tube, tIndex) => {
                  const isSelected = selectedTube === tIndex;
                  const isShaking = shakeTube === tIndex;
                  const isSolved = isTubeSolved(tube) && tube.length > 0;

                  return (
                    <motion.div
                      key={tIndex}
                      animate={isShaking ? { x: [-8, 8, -8, 8, 0] } : { x: 0 }}
                      transition={{ duration: 0.4 }}
                      onClick={() => handleTubeClick(tIndex)}
                      className={`relative flex flex-col-reverse justify-start items-center w-16 sm:w-20 h-56 sm:h-64 bg-gradient-to-b from-white/[0.03] to-white/[0.08] border-x-2 border-b-2 rounded-b-[2rem] rounded-t-xl transition-all cursor-pointer ${isSelected ? "border-white shadow-[0_0_25px_rgba(255,255,255,0.3)] scale-[1.02]" : isSolved ? "border-emerald-400/50 shadow-[0_0_40px_rgba(16,185,129,0.2)] bg-emerald-900/30" : "border-white/20 hover:border-white/50"}`}
                    >
                      {/* Solved Sparkle */}
                      {isSolved && (
                        <ShieldCheck className="absolute -bottom-12 text-emerald-400 w-8 h-8 animate-bounce" />
                      )}

                      {/* Render Orbs */}
                      {tube.map((color, bIndex) => {
                        const isTopBall = bIndex === tube.length - 1;
                        const liftUp = isSelected && isTopBall;

                        return (
                          <motion.div
                            key={`tube-${tIndex}-ball-${bIndex}`}
                            layoutId={`ball-${color}-${tIndex}-${bIndex}`}
                            initial={false}
                            animate={{ y: liftUp ? -50 : 0 }}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 25,
                            }}
                            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${color} shadow-[0_0_15px_var(--tw-shadow-color)] my-[2px] relative`}
                          >
                            <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 hover:opacity-100 transition-opacity" />
                            <div className="absolute top-1 left-2 w-3 h-3 bg-white/40 rounded-full blur-[2px]" />
                          </motion.div>
                        );
                      })}

                      {/* Open top lip design */}
                      <div className="absolute -top-1 w-[120%] h-4 border-[3px] border-white/20 rounded-[100%] bg-transparent z-10 opacity-70" />
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {gameState === "WON" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
              <div className="bg-slate-900/90 border border-white/10 p-10 rounded-[2rem] text-center max-w-md w-full relative z-10 shadow-[0_0_80px_rgba(59,130,246,0.3)]">
                <div className="w-24 h-24 mx-auto mb-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Star className="w-12 h-12 text-amber-400 fill-amber-400 animate-pulse" />
                </div>

                <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-wide">
                  Stage Cleared
                </h2>
                <p className="text-white/60 mb-8 font-medium">
                  Outstanding logic! You beat the clock.
                </p>

                <div className="bg-black/50 p-4 rounded-xl mb-8 flex justify-around">
                  <div>
                    <p className="text-white/40 text-xs uppercase font-bold mb-1">
                      Moves Taken
                    </p>
                    <p className="text-2xl text-white font-bold">{moves}</p>
                  </div>
                  <div className="w-px bg-white/10" />
                  <div>
                    <p className="text-white/40 text-xs uppercase font-bold mb-1">
                      New Score
                    </p>
                    <p className="text-2xl text-amber-400 font-bold">{score}</p>
                  </div>
                </div>

                <Button
                  onClick={startNextLevel}
                  className="w-full py-7 text-lg font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                >
                  Proceed to Stage {level}{" "}
                  <Zap className="ml-2 w-5 h-5 fill-white" />
                </Button>
                <Button
                  onClick={() => setGameState("MENU")}
                  variant="ghost"
                  className="w-full mt-4 text-white/50 hover:text-white"
                >
                  Return to Levels
                </Button>
              </div>
            </motion.div>
          )}

          {gameState === "LOST" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="absolute inset-0 bg-rose-900/40 backdrop-blur-md" />
              <div className="bg-slate-900/95 border border-rose-500/30 p-10 rounded-[2rem] text-center max-w-md w-full relative z-10 shadow-[0_0_80px_rgba(225,29,72,0.3)]">
                <div className="w-24 h-24 mx-auto mb-6 bg-rose-500/20 rounded-full flex items-center justify-center">
                  <XCircle className="w-12 h-12 text-rose-500 animate-pulse" />
                </div>

                <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-wide">
                  Time's Up!
                </h2>
                <p className="text-white/60 mb-8 font-medium">
                  You need to be faster. Every second counts!
                </p>

                <Button
                  onClick={() => selectLevelToPlay(level)}
                  className="w-full mb-4 py-7 text-lg font-bold uppercase tracking-widest bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-[0_0_20px_rgba(225,29,72,0.4)]"
                >
                  Try Again
                </Button>
                <Button
                  onClick={() => setGameState("MENU")}
                  variant="ghost"
                  className="w-full text-white/50 hover:text-white"
                >
                  Main Menu
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
