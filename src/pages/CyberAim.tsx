import { useState, useEffect, useRef, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Play,
  Trophy,
  Crosshair,
  Volume2,
  VolumeX,
  Flame,
  Target,
  RotateCcw,
  Lock,
  Unlock,
  ChevronRight,
  Star,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type TargetObj = {
  id: number;
  x: number;
  y: number;
  size: number;
  createdAt: number;
  duration: number; // How long it stays
};

type FloatingText = {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
};

// Stage Definitions for progression
const STAGES = [
  {
    id: 1,
    name: "Tutorial",
    targetScore: 300,
    spawnRateOffset: 0,
    minSize: 50,
    durationOffset: 0,
    description: "Hit slow targets to get a feel of the neon grid.",
  },
  {
    id: 2,
    name: "Novice",
    targetScore: 800,
    spawnRateOffset: 200,
    minSize: 40,
    durationOffset: 500,
    description: "Slightly faster, build up your combo for bonus points.",
  },
  {
    id: 3,
    name: "Adept",
    targetScore: 1500,
    spawnRateOffset: 400,
    minSize: 30,
    durationOffset: 800,
    description: "Targets fade out quicker. Keep your eyes sharp.",
  },
  {
    id: 4,
    name: "Sharpshooter",
    targetScore: 2500,
    spawnRateOffset: 550,
    minSize: 20,
    durationOffset: 1000,
    description: "Small targets, high speed. Accuracy is key.",
  },
  {
    id: 5,
    name: "Cyber Ninja",
    targetScore: 4000,
    spawnRateOffset: 650,
    minSize: 15,
    durationOffset: 1200,
    description: "Lightning reflexes required. Survive the onslaught.",
  },
];

const CyberReflex = () => {
  // Global States
  const [gameState, setGameState] = useState<
    "menu" | "playing" | "stage_clear" | "stage_fail"
  >("menu");
  const [currentStageId, setCurrentStageId] = useState<number>(1);
  const [unlockedStageId, setUnlockedStageId] = useState<number>(1);
  const [careerStats, setCareerStats] = useState({
    totalHits: 0,
    maxCombo: 0,
    totalScore: 0,
  });
  const [isMuted, setIsMuted] = useState(false);

  // In-Game States
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [hits, setHits] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [targets, setTargets] = useState<TargetObj[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [screenShake, setScreenShake] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load progress from localStorage on mount
  useEffect(() => {
    const savedProgress = localStorage.getItem("cyberReflexProgress");
    if (savedProgress) {
      const data = JSON.parse(savedProgress);
      if (data.unlockedStageId) setUnlockedStageId(data.unlockedStageId);
      if (data.careerStats) setCareerStats(data.careerStats);
    }
  }, []);

  // Save progress when it changes
  useEffect(() => {
    localStorage.setItem(
      "cyberReflexProgress",
      JSON.stringify({
        unlockedStageId,
        careerStats,
      }),
    );
  }, [unlockedStageId, careerStats]);

  // Background Music setup
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.4;
      if (gameState === "playing" && !isMuted) {
        audioRef.current
          .play()
          .catch(() => console.log("Audio autoplay blocked"));
      } else {
        audioRef.current.pause();
      }
    }
  }, [gameState, isMuted]);

  // Play shooting sound
  const playShootSound = useCallback(
    (hit: boolean) => {
      if (isMuted) return;
      const synth = new AudioContext();
      const osc = synth.createOscillator();
      const gainNode = synth.createGain();

      osc.connect(gainNode);
      gainNode.connect(synth.destination);

      if (hit) {
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, synth.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
          300,
          synth.currentTime + 0.1,
        );
        gainNode.gain.setValueAtTime(0.1, synth.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          synth.currentTime + 0.1,
        );
        osc.start();
        osc.stop(synth.currentTime + 0.1);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, synth.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, synth.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, synth.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          synth.currentTime + 0.1,
        );
        osc.start();
        osc.stop(synth.currentTime + 0.1);
      }
    },
    [isMuted],
  );

  // Timer & Game Loop
  useEffect(() => {
    let timerId: ReturnType<typeof setInterval>;
    let spawnerId: ReturnType<typeof setInterval>;

    if (gameState === "playing") {
      const stageConfig =
        STAGES.find((s) => s.id === currentStageId) || STAGES[0];

      timerId = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleGameEnd();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Spawn targets randomly based on stage configuration
      spawnerId = setInterval(
        () => {
          if (!containerRef.current) return;
          const { clientWidth, clientHeight } = containerRef.current;

          // Difficulty progression based on time remaining and stage offsets
          const minSize = stageConfig.minSize + (timeLeft / 60) * 20;
          const size = minSize + Math.random() * 20;

          const padding = size + 10;
          const x = Math.max(
            padding,
            Math.random() * (clientWidth - padding * 2),
          );
          const y = Math.max(
            padding,
            Math.random() * (clientHeight - padding * 2),
          );

          const duration = Math.max(
            600,
            2000 - stageConfig.durationOffset + Math.random() * 1000,
          );

          const newTarget: TargetObj = {
            id: Date.now() + Math.random(),
            x,
            y,
            size,
            createdAt: Date.now(),
            duration,
          };

          setTargets((prev) => [...prev, newTarget]);
        },
        Math.max(300, 1000 - stageConfig.spawnRateOffset - (60 - timeLeft) * 5),
      );
    }

    return () => {
      clearInterval(timerId);
      clearInterval(spawnerId);
    };
  }, [gameState, timeLeft, currentStageId]);

  // Target Expiration Loop (Remove targets if they expire)
  useEffect(() => {
    let expireId: ReturnType<typeof setTimeout>;
    if (gameState === "playing") {
      expireId = setInterval(() => {
        const now = Date.now();
        setTargets((prev) => {
          const alive = prev.filter((t) => now - t.createdAt < t.duration);
          if (alive.length < prev.length) {
            // Target Missed
            setCombo(0);
          }
          return alive;
        });
      }, 100);
    }
    return () => clearInterval(expireId);
  }, [gameState]);

  // Floating text cleanup
  useEffect(() => {
    if (floatingTexts.length > 0) {
      const timeout = setTimeout(() => {
        setFloatingTexts((prev) => prev.slice(1));
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [floatingTexts]);

  const handleGameEnd = () => {
    const stageConfig =
      STAGES.find((s) => s.id === currentStageId) || STAGES[0];

    // Update global career stats when game ends
    setCareerStats((prev) => ({
      totalHits: prev.totalHits + hits,
      maxCombo: Math.max(prev.maxCombo, maxCombo),
      totalScore: prev.totalScore + score,
    }));

    if (score >= stageConfig.targetScore) {
      // Clear stage
      if (
        currentStageId === unlockedStageId &&
        unlockedStageId < STAGES.length
      ) {
        setUnlockedStageId((prev) => prev + 1);
      }
      setGameState("stage_clear");
    } else {
      setGameState("stage_fail");
    }
  };

  const startStage = (id: number) => {
    setCurrentStageId(id);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setClicks(0);
    setHits(0);
    setTimeLeft(60);
    setTargets([]);
    setFloatingTexts([]);
    setGameState("playing");
  };

  const triggerScreenShake = () => {
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 200);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (gameState !== "playing") return;
    setClicks((prev) => prev + 1);
    setCombo(0); // Reset combo on miss click
    triggerScreenShake();
    playShootSound(false);
  };

  const handleTargetClick = (e: React.MouseEvent, targetId: number) => {
    e.stopPropagation(); // prevent container click
    if (gameState !== "playing") return;

    setClicks((prev) => prev + 1);
    setHits((prev) => prev + 1);
    playShootSound(true);

    const newCombo = combo + 1;
    setCombo(newCombo);
    if (newCombo > maxCombo) setMaxCombo(newCombo);

    // Score multipliers
    const comboMultiplier = 1 + Math.floor(newCombo / 5) * 0.5;
    const basePoints = 10;
    const points = Math.floor(basePoints * comboMultiplier);

    setScore((prev) => prev + points);

    // Floating text positioning
    const rect = (e.target as HTMLDivElement).getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      const x = rect.left - containerRect.left + rect.width / 2;
      const y = rect.top - containerRect.top;

      setFloatingTexts((prev) => [
        ...prev,
        {
          id: Date.now(),
          x,
          y,
          text: `+${points}`,
          color:
            newCombo >= 15 ? "#ef4444" : newCombo >= 5 ? "#f59e0b" : "#22d3ee",
        },
      ]);
    }

    // Remove targeted element
    setTargets((prev) => prev.filter((t) => t.id !== targetId));
  };

  const accuracy = clicks === 0 ? 0 : Math.round((hits / clicks) * 100);
  const currentStageConfig =
    STAGES.find((s) => s.id === currentStageId) || STAGES[0];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 flex flex-col h-[calc(100vh-80px)] md:h-[calc(100vh-20px)] relative">
        <audio
          ref={audioRef}
          src="https://cdn.pixabay.com/download/audio/2022/10/25/audio_244a0eb52d.mp3?filename=cyberpunk-2099-10701.mp3"
          loop
        />

        {/* Global Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent italic tracking-wider flex items-center gap-3">
              CYBER REFLEX <Target className="w-6 h-6 text-cyan-400" />
            </h1>
            <p className="text-muted-foreground text-sm uppercase tracking-widest mt-1 opacity-80">
              Tactical Aim Trainer
            </p>
          </div>
          <div className="flex items-center gap-4">
            {gameState === "menu" && (
              <div className="hidden md:flex items-center gap-4 bg-background/50 border border-border/50 px-4 py-2 rounded-2xl glass">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                    Total Hits
                  </p>
                  <p className="font-black text-cyan-400">
                    {careerStats.totalHits}
                  </p>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                    Best Combo
                  </p>
                  <p className="font-black text-orange-400">
                    x{careerStats.maxCombo}
                  </p>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary rounded-full glass border border-white/5"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Main Interface */}
        <div
          className={`flex-1 glass rounded-[2.5rem] overflow-hidden relative border border-white/5 flex flex-col shadow-2xl shadow-cyan-500/10 transition-transform ${screenShake ? "translate-x-1 -translate-y-1" : ""}`}
        >
          {gameState === "menu" ? (
            // --- MENU & STAGE SELECT ---
            <div
              className="absolute inset-0 bg-[#050510] flex flex-col items-center justify-center p-8 overflow-y-auto"
              style={{
                backgroundImage: `radial-gradient(circle at top right, rgba(0,255,255,0.05) 0%, transparent 40%), radial-gradient(circle at bottom left, rgba(147,51,234,0.05) 0%, transparent 40%)`,
              }}
            >
              <div className="w-full max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-8 my-auto">
                <div className="text-center space-y-2 mb-12">
                  <ShieldCheck className="w-16 h-16 text-cyan-400 mx-auto drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] mb-4" />
                  <h2 className="text-4xl font-black text-white uppercase tracking-widest">
                    Select Stage
                  </h2>
                  <p className="text-muted-foreground">
                    Complete stages to unlock harder difficulties.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {STAGES.map((stage) => {
                    const isUnlocked = stage.id <= unlockedStageId;
                    const isCurrent = stage.id === unlockedStageId;

                    return (
                      <div
                        key={stage.id}
                        className={`relative rounded-3xl p-6 overflow-hidden border transition-all duration-300
                                 ${
                                   isUnlocked
                                     ? "glass border-cyan-500/30 hover:border-cyan-400 cursor-pointer hover:scale-105 group"
                                     : "bg-black/40 border-white/5 opacity-60 grayscale cursor-not-allowed"
                                 }
                              `}
                        onClick={() => isUnlocked && startStage(stage.id)}
                      >
                        {isUnlocked && (
                          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}

                        <div className="flex justify-between items-start mb-4 relative z-10">
                          <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                              Stage {stage.id}
                              {isCurrent && (
                                <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400 animate-pulse" />
                              )}
                            </h3>
                            <p
                              className={`text-sm font-semibold mt-1 ${isUnlocked ? "text-cyan-400" : "text-muted-foreground"}`}
                            >
                              {stage.name}
                            </p>
                          </div>
                          <div className="w-10 h-10 rounded-full glass flex items-center justify-center border border-white/10">
                            {isUnlocked ? (
                              <Unlock className="w-4 h-4 text-cyan-400" />
                            ) : (
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        <div className="space-y-3 relative z-10">
                          <p className="text-xs text-muted-foreground min-h-[40px]">
                            {isUnlocked ? stage.description : "Locked"}
                          </p>

                          <div className="flex items-center justify-between border-t border-white/10 pt-4">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Target Score
                            </span>
                            <span className="font-bold text-white flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-500" />{" "}
                              {stage.targetScore}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            // --- GAME UI ---
            <div className="flex-1 relative flex flex-col h-full min-h-0">
              {/* Top HUD */}
              <div className="h-16 border-b border-white/10 bg-black/60 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 relative z-20 shrink-0">
                <div className="flex items-center gap-4 md:gap-8">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                      Stage {currentStageId}
                    </span>
                    <span
                      className={`text-xl md:text-2xl font-black tabular-nums ${timeLeft <= 10 ? "text-red-500 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "text-white"}`}
                    >
                      00:{timeLeft.toString().padStart(2, "0")}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-white/10 hidden md:block"></div>
                  <div className="flex-col hidden md:flex">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                      Accuracy
                    </span>
                    <span className="text-xl font-black text-cyan-400">
                      {accuracy}%
                    </span>
                  </div>
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                      Target
                    </span>
                    <span className="text-[10px] text-yellow-400 font-bold">
                      {currentStageConfig.targetScore}
                    </span>
                  </div>
                  <span
                    className={`text-3xl font-black tabular-nums tracking-wider leading-none drop-shadow-md ${score >= currentStageConfig.targetScore ? "text-green-400" : "text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60"}`}
                  >
                    {score.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold hidden md:inline">
                    Combo
                  </span>
                  <div
                    className={`flex items-center gap-1.5 ${combo >= 15 ? "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" : combo >= 5 ? "text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" : "text-purple-400"}`}
                  >
                    <Flame
                      className={`w-5 h-5 ${combo >= 10 ? "animate-pulse" : ""}`}
                    />
                    <span className="text-xl md:text-2xl font-black tabular-nums">
                      x{combo}
                    </span>
                  </div>
                </div>
              </div>

              {/* Game Arena */}
              <div
                ref={containerRef}
                className={`flex-1 relative bg-[#050510] overflow-hidden cursor-crosshair rounded-b-[2.5rem]`}
                onClick={handleContainerClick}
                style={{
                  backgroundImage: `radial-gradient(circle at center, transparent 0%, #000 100%), linear-gradient(rgba(0, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.03) 1px, transparent 1px)`,
                  backgroundSize: "100% 100%, 40px 40px, 40px 40px",
                  backgroundPosition: "center center",
                }}
              >
                {/* Result Screens Overlay */}
                {(gameState === "stage_clear" ||
                  gameState === "stage_fail") && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl z-50 animate-in fade-in zoom-in duration-500 rounded-b-[2.5rem]">
                    {gameState === "stage_clear" ? (
                      <>
                        <Trophy className="w-24 h-24 text-yellow-400 mb-6 drop-shadow-[0_0_30px_rgba(250,204,21,0.6)] animate-bounce" />
                        <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-green-400 to-green-600 mb-2 uppercase tracking-widest drop-shadow-[0_0_10px_rgba(34,197,94,0.4)] text-center">
                          STAGE CLEARED
                        </h2>
                        <p className="text-green-300 font-bold mt-2">
                          Target Score: {currentStageConfig.targetScore}{" "}
                          achieved!
                        </p>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-24 h-24 text-red-500 mb-6 drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]" />
                        <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-red-400 to-red-600 mb-2 uppercase tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.4)] text-center">
                          MISSION FAILED
                        </h2>
                        <p className="text-red-300 font-bold mt-2">
                          Needed {currentStageConfig.targetScore} points to
                          pass.
                        </p>
                      </>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 my-10 w-full max-w-3xl px-4">
                      <div className="glass bg-white/5 p-4 rounded-2xl flex flex-col items-center border border-white/10 shadow-lg">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">
                          Score
                        </span>
                        <span
                          className={`text-2xl font-black ${score >= currentStageConfig.targetScore ? "text-green-400" : "text-red-400"}`}
                        >
                          {score.toLocaleString()}
                        </span>
                      </div>
                      <div className="glass bg-white/5 p-4 rounded-2xl flex flex-col items-center border border-white/10 shadow-lg">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">
                          Accuracy
                        </span>
                        <span className="text-2xl font-black text-cyan-400">
                          {accuracy}%
                        </span>
                      </div>
                      <div className="glass bg-white/5 p-4 rounded-2xl flex flex-col items-center border border-white/10 shadow-lg">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">
                          Hits
                        </span>
                        <span className="text-2xl font-black text-purple-400">
                          {hits}
                        </span>
                      </div>
                      <div className="glass bg-white/5 p-4 rounded-2xl flex flex-col items-center border border-white/10 shadow-lg">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">
                          Max Combo
                        </span>
                        <span className="text-2xl font-black text-orange-400">
                          x{maxCombo}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4">
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => setGameState("menu")}
                        className="h-14 px-10 rounded-full border-white/20 hover:bg-white/10 text-white font-bold"
                      >
                        Main Menu
                      </Button>

                      {gameState === "stage_clear" ? (
                        <Button
                          size="lg"
                          onClick={() =>
                            startStage(
                              currentStageId < STAGES.length
                                ? currentStageId + 1
                                : currentStageId,
                            )
                          }
                          className="h-14 px-12 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-black text-lg hover:scale-105 shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all"
                        >
                          {currentStageId === STAGES.length
                            ? "PLAY AGAIN"
                            : "NEXT STAGE"}{" "}
                          <ChevronRight className="w-5 h-5 ml-2" />
                        </Button>
                      ) : (
                        <Button
                          size="lg"
                          onClick={() => startStage(currentStageId)}
                          className="h-14 px-12 rounded-full bg-red-500 hover:bg-red-400 text-white font-black text-lg hover:scale-105 shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all"
                        >
                          <RotateCcw className="w-5 h-5 mr-2" /> RETRY STAGE
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Render Targets */}
                {gameState === "playing" &&
                  targets.map((target) => {
                    const age = Date.now() - target.createdAt;
                    const lifeRatio = age / target.duration;
                    const isFading = lifeRatio > 0.7;

                    return (
                      <div
                        key={target.id}
                        onMouseDown={(e) => handleTargetClick(e, target.id)}
                        className={`absolute rounded-full flex items-center justify-center border-[3px] shadow-[0_0_25px_inherit] animate-in zoom-in duration-200 ease-out transition-all hover:scale-110
                          ${isFading ? "border-red-500 bg-red-500/20 text-red-500 shadow-red-500/60 scale-90" : "border-cyan-400 bg-cyan-400/20 text-cyan-400 shadow-cyan-400/60"}
                        `}
                        style={{
                          left: Math.floor(target.x),
                          top: Math.floor(target.y),
                          width: Math.floor(target.size),
                          height: Math.floor(target.size),
                        }}
                      >
                        <div className="w-1.5 h-1.5 bg-current rounded-full" />
                      </div>
                    );
                  })}

                {/* Floating Score Texts */}
                {floatingTexts.map((ft) => (
                  <div
                    key={ft.id}
                    className="absolute font-black text-2xl pointer-events-none animate-out fade-out slide-out-to-top-12 duration-700 ease-out z-20 mix-blend-screen"
                    style={{
                      left: ft.x,
                      top: ft.y,
                      color: ft.color,
                      textShadow: `0 0 15px ${ft.color}, 0 0 30px ${ft.color}`,
                    }}
                  >
                    {ft.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default CyberReflex;
