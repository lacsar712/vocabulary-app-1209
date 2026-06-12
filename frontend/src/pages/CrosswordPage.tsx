import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { crosswordApi } from '../api';
import type { CrosswordResponse, CrosswordClue, CrosswordCellResult } from '../api';
import { ArrowLeft, Lightbulb, CheckSquare, Clock, Trophy, Sparkles, RotateCcw, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const GRID_SIZE = 5;

interface CellState {
    letter: string;
    isActive: boolean;
    isRevealed: boolean;
    checkResult: 'correct' | 'incorrect' | null;
}

const CrosswordPage: React.FC = () => {
    const navigate = useNavigate();
    const [puzzle, setPuzzle] = useState<CrosswordResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [grid, setGrid] = useState<CellState[][]>([]);
    const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
    const [selectedDirection, setSelectedDirection] = useState<'across' | 'down'>('across');
    const [selectedClue, setSelectedClue] = useState<CrosswordClue | null>(null);
    const [hintsLeft, setHintsLeft] = useState(3);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [startTime, setStartTime] = useState<number>(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [cellResults, setCellResults] = useState<CrosswordCellResult[][] | null>(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const [bestTime, setBestTime] = useState<number | null>(null);
    const [bestHints, setBestHints] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showHintMenu, setShowHintMenu] = useState(false);
    const [revealedClue, setRevealedClue] = useState<{ word: string; direction: string } | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const initGrid = useCallback((puzzleData: CrosswordResponse) => {
        const newGrid: CellState[][] = Array.from({ length: GRID_SIZE }, (_, r) =>
            Array.from({ length: GRID_SIZE }, (_, c) => {
                const cell = puzzleData.grid[r]?.[c];
                return {
                    letter: '',
                    isActive: cell !== null && cell !== undefined,
                    isRevealed: false,
                    checkResult: null,
                };
            })
        );
        setGrid(newGrid);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const [puzzleRes, bestRes] = await Promise.all([
                crosswordApi.getPuzzle(),
                crosswordApi.getBestScore()
            ]);
            setPuzzle(puzzleRes.data);
            setBestTime(bestRes.data.best_time);
            setBestHints(bestRes.data.best_hints);

            if (puzzleRes.data.submission) {
                setIsComplete(true);
                setElapsedTime(puzzleRes.data.submission.time_spent);
                setHintsUsed(puzzleRes.data.submission.hints_used);
            }

            initGrid(puzzleRes.data);
            setStartTime(Date.now());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [initGrid]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (isComplete || !startTime) return;

        timerRef.current = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isComplete, startTime]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const getClueCells = useCallback((clue: CrosswordClue): { row: number; col: number }[] => {
        const cells: { row: number; col: number }[] = [];
        for (let i = 0; i < clue.word_length; i++) {
            if (clue.direction === 'across') {
                cells.push({ row: clue.row, col: clue.col + i });
            } else {
                cells.push({ row: clue.row + i, col: clue.col });
            }
        }
        return cells;
    }, []);

    const isCellInClue = useCallback((row: number, col: number, clue: CrosswordClue) => {
        if (clue.direction === 'across') {
            return row === clue.row && col >= clue.col && col < clue.col + clue.word_length;
        } else {
            return col === clue.col && row >= clue.row && row < clue.row + clue.word_length;
        }
    }, []);

    const getCluesForCell = useCallback((row: number, col: number) => {
        if (!puzzle) return { across: null, down: null };
        const across = puzzle.clues_across.find(c => isCellInClue(row, col, c));
        const down = puzzle.clues_down.find(c => isCellInClue(row, col, c));
        return { across, down };
    }, [puzzle, isCellInClue]);

    const handleCellClick = useCallback((row: number, col: number) => {
        if (!grid[row]?.[col]?.isActive) return;
        if (isComplete) return;

        const { across, down } = getCluesForCell(row, col);

        if (selectedCell?.row === row && selectedCell?.col === col) {
            if (across && down) {
                const newDir = selectedDirection === 'across' ? 'down' : 'across';
                setSelectedDirection(newDir);
                setSelectedClue(newDir === 'across' ? across : down);
            }
        } else {
            setSelectedCell({ row, col });
            if (across && down) {
                setSelectedClue(selectedDirection === 'across' ? across : down);
            } else if (across) {
                setSelectedDirection('across');
                setSelectedClue(across);
            } else if (down) {
                setSelectedDirection('down');
                setSelectedClue(down);
            }
        }

        inputRef.current?.focus();
    }, [grid, isComplete, selectedCell, selectedDirection, getCluesForCell]);

    const moveToNextCell = useCallback((row: number, col: number) => {
        if (!selectedClue) return;
        const cells = getClueCells(selectedClue);
        const currentIdx = cells.findIndex(c => c.row === row && c.col === col);
        if (currentIdx < cells.length - 1) {
            const next = cells[currentIdx + 1];
            setSelectedCell(next);
        }
    }, [selectedClue, getClueCells]);

    const moveToPrevCell = useCallback((row: number, col: number) => {
        if (!selectedClue) return;
        const cells = getClueCells(selectedClue);
        const currentIdx = cells.findIndex(c => c.row === row && c.col === col);
        if (currentIdx > 0) {
            const prev = cells[currentIdx - 1];
            setSelectedCell(prev);
        }
    }, [selectedClue, getClueCells]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!selectedCell || isComplete) return;
        const { row, col } = selectedCell;

        if (e.key === 'Backspace') {
            e.preventDefault();
            setGrid(prev => {
                const newGrid = prev.map(r => r.map(c => ({ ...c })));
                if (newGrid[row][col].letter) {
                    newGrid[row][col].letter = '';
                    newGrid[row][col].checkResult = null;
                } else {
                    moveToPrevCell(row, col);
                    const { across, down } = getCluesForCell(row, col);
                    const clue = selectedDirection === 'across' ? across : down;
                    if (clue) {
                        const cells = getClueCells(clue);
                        const idx = cells.findIndex(c => c.row === row && c.col === col);
                        if (idx > 0) {
                            const prev = cells[idx - 1];
                            newGrid[prev.row][prev.col].letter = '';
                            newGrid[prev.row][prev.col].checkResult = null;
                        }
                    }
                }
                return newGrid;
            });
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            for (let r = row - 1; r >= 0; r--) {
                if (grid[r][col].isActive) {
                    setSelectedCell({ row: r, col });
                    setSelectedDirection('down');
                    const { down } = getCluesForCell(r, col);
                    if (down) setSelectedClue(down);
                    break;
                }
            }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            for (let r = row + 1; r < GRID_SIZE; r++) {
                if (grid[r][col].isActive) {
                    setSelectedCell({ row: r, col });
                    setSelectedDirection('down');
                    const { down } = getCluesForCell(r, col);
                    if (down) setSelectedClue(down);
                    break;
                }
            }
            return;
        }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            for (let c = col - 1; c >= 0; c--) {
                if (grid[row][c].isActive) {
                    setSelectedCell({ row, col: c });
                    setSelectedDirection('across');
                    const { across } = getCluesForCell(row, c);
                    if (across) setSelectedClue(across);
                    break;
                }
            }
            return;
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            for (let c = col + 1; c < GRID_SIZE; c++) {
                if (grid[row][c].isActive) {
                    setSelectedCell({ row, col: c });
                    setSelectedDirection('across');
                    const { across } = getCluesForCell(row, c);
                    if (across) setSelectedClue(across);
                    break;
                }
            }
            return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            const allClues = [...(puzzle?.clues_across || []), ...(puzzle?.clues_down || [])];
            const currentIdx = allClues.findIndex(c => selectedClue && c.row === selectedClue.row && c.col === selectedClue.col && c.direction === selectedClue.direction);
            const nextIdx = e.shiftKey
                ? (currentIdx - 1 + allClues.length) % allClues.length
                : (currentIdx + 1) % allClues.length;
            const nextClue = allClues[nextIdx];
            setSelectedClue(nextClue);
            setSelectedDirection(nextClue.direction as 'across' | 'down');
            setSelectedCell({ row: nextClue.row, col: nextClue.col });
            return;
        }

        if (/^[a-zA-Z]$/.test(e.key)) {
            e.preventDefault();
            const letter = e.key.toUpperCase();
            setGrid(prev => {
                const newGrid = prev.map(r => r.map(c => ({ ...c })));
                newGrid[row][col].letter = letter;
                newGrid[row][col].checkResult = null;
                return newGrid;
            });
            moveToNextCell(row, col);
        }
    }, [selectedCell, isComplete, grid, selectedDirection, selectedClue, puzzle, moveToNextCell, moveToPrevCell, getCluesForCell, getClueCells]);

    const handleHintCell = async () => {
        if (hintsLeft <= 0 || !selectedCell) return;
        try {
            const res = await crosswordApi.getHint('cell', selectedCell.row, selectedCell.col);
            const data = res.data as { hint: string | null };
            if (data.hint) {
                setGrid(prev => {
                    const newGrid = prev.map(r => r.map(c => ({ ...c })));
                    newGrid[selectedCell.row][selectedCell.col].letter = data.hint!.toUpperCase();
                    newGrid[selectedCell.row][selectedCell.col].isRevealed = true;
                    return newGrid;
                });
                setHintsLeft(prev => prev - 1);
                setHintsUsed(prev => prev + 1);
            }
        } catch (e) {
            console.error(e);
        }
        setShowHintMenu(false);
    };

    const handleHintClue = async () => {
        if (hintsLeft <= 0 || !puzzle) return;
        try {
            const res = await crosswordApi.getHint('clue');
            const data = res.data as { hint: { word: string; clue: string; direction: string; row: number; col: number } | null };
            if (data.hint) {
                setRevealedClue({ word: data.hint.word, direction: data.hint.direction });
                setTimeout(() => setRevealedClue(null), 5000);
                setHintsLeft(prev => prev - 1);
                setHintsUsed(prev => prev + 1);
            }
        } catch (e) {
            console.error(e);
        }
        setShowHintMenu(false);
    };

    const checkRowOrCol = () => {
        if (!selectedCell || !selectedClue || isComplete) return;
        const cells = getClueCells(selectedClue);

        setGrid(prev => {
            const newGrid = prev.map(r => r.map(c => ({ ...c })));
            for (const cell of cells) {
                const cellState = newGrid[cell.row][cell.col];
                if (cellState.letter && !cellState.isRevealed) {
                    cellState.checkResult = 'pending';
                }
            }
            return newGrid;
        });

        crosswordApi.getPuzzle().then(res => {
            const solutionGrid = res.data.grid;
            setGrid(prev => {
                const newGrid = prev.map(r => r.map(c => ({ ...c })));
                for (const cell of cells) {
                    const cellState = newGrid[cell.row][cell.col];
                    if (cellState.letter && !cellState.isRevealed) {
                        const sol = solutionGrid[cell.row]?.[cell.col];
                        if (sol && cellState.letter.toLowerCase() === sol.toLowerCase()) {
                            cellState.checkResult = 'correct';
                        } else {
                            cellState.checkResult = 'incorrect';
                        }
                    }
                }
                return newGrid;
            });
        }).catch(() => {
            setGrid(prev => {
                const newGrid = prev.map(r => r.map(c => ({ ...c })));
                for (const cell of cells) {
                    const cellState = newGrid[cell.row][cell.col];
                    if (cellState.checkResult === 'pending') {
                        cellState.checkResult = null;
                    }
                }
                return newGrid;
            });
        });
    };

    const handleSubmit = async () => {
        if (submitting || isComplete) return;
        setSubmitting(true);

        const answers = grid.map(row => row.map(cell => cell.letter || ''));
        const timeSpent = elapsedTime;

        try {
            const res = await crosswordApi.submitPuzzle(answers, timeSpent, hintsUsed);
            setIsComplete(true);
            setCellResults(res.data.cell_results);

            if (timerRef.current) clearInterval(timerRef.current);

            if (res.data.is_correct) {
                setShowCelebration(true);
                if (!bestTime || timeSpent < bestTime) {
                    setBestTime(timeSpent);
                    setBestHints(hintsUsed);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        if (!puzzle) return;
        initGrid(puzzle);
        setSelectedCell(null);
        setSelectedClue(null);
        setHintsLeft(3);
        setHintsUsed(0);
        setElapsedTime(0);
        setIsComplete(false);
        setCellResults(null);
        setShowCelebration(false);
        setStartTime(Date.now());
    };

    const isAllFilled = grid.every(row => row.every(cell => !cell.isActive || cell.letter !== ''));

    const getCellHighlight = (row: number, col: number) => {
        if (!selectedCell || !selectedClue) return false;
        return isCellInClue(row, col, selectedClue);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-white text-lg">加载填字游戏...</div>
            </div>
        );
    }

    if (!puzzle) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-white text-lg mb-4">无法加载谜题</p>
                    <button onClick={() => navigate('/')} className="btn-primary">返回首页</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 p-4 md:p-8" onClick={() => inputRef.current?.focus()}>
            <input
                ref={inputRef}
                className="opacity-0 absolute w-0 h-0"
                onKeyDown={handleKeyDown}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
            />

            <div className="max-w-4xl mx-auto">
                <header className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition"
                    >
                        <ArrowLeft size={20} />
                        <span>返回</span>
                    </button>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
                        填字游戏
                    </h1>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-sm text-slate-400">
                            <Clock size={16} className="text-cyan-400" />
                            <span className="font-mono text-white">{formatTime(elapsedTime)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                            <Lightbulb size={16} className={hintsLeft > 0 ? 'text-amber-400' : 'text-slate-600'} />
                            <span className={hintsLeft > 0 ? 'text-amber-400' : 'text-slate-600'}>{hintsLeft}</span>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3">
                        <div className="glass-panel p-6 rounded-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-white">5 × 5 迷你填字</h2>
                                <span className="text-xs text-slate-500">{puzzle.date}</span>
                            </div>

                            <div
                                className="flex justify-center overflow-x-auto pb-2"
                                onTouchStart={(e) => e.stopPropagation()}
                            >
                                <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
                                    {grid.map((row, r) =>
                                        row.map((cell, c) => {
                                            const isSelected = selectedCell?.row === r && selectedCell?.col === c;
                                            const isHighlighted = getCellHighlight(r, c);
                                            const resultCell = cellResults?.[r]?.[c];

                                            let bgClass = 'bg-slate-800';
                                            if (!cell.isActive) {
                                                bgClass = 'bg-slate-950';
                                            } else if (isComplete && cellResults) {
                                                if (resultCell && !resultCell.empty) {
                                                    bgClass = resultCell.correct ? 'bg-emerald-600' : 'bg-red-600';
                                                }
                                            } else if (cell.checkResult === 'correct') {
                                                bgClass = 'bg-emerald-700';
                                            } else if (cell.checkResult === 'incorrect') {
                                                bgClass = 'bg-red-700';
                                            } else if (isSelected) {
                                                bgClass = 'bg-cyan-600';
                                            } else if (isHighlighted) {
                                                bgClass = 'bg-cyan-900';
                                            } else if (cell.isRevealed) {
                                                bgClass = 'bg-amber-700';
                                            }

                                            const borderClass = isSelected
                                                ? 'ring-2 ring-cyan-400'
                                                : cell.isActive
                                                    ? 'border border-slate-600'
                                                    : 'border border-slate-800';

                                            const isClueStart = [...puzzle.clues_across, ...puzzle.clues_down].some(
                                                clue => clue.row === r && clue.col === c
                                            );
                                            const clueNumbers = [...puzzle.clues_across, ...puzzle.clues_down]
                                                .map((clue, idx) => clue.row === r && clue.col === c ? idx + 1 : null)
                                                .filter(Boolean);

                                            return (
                                                <div
                                                    key={`${r}-${c}`}
                                                    className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center relative select-none ${bgClass} ${borderClass} ${cell.isActive ? 'cursor-pointer' : ''} transition-colors duration-200`}
                                                    onClick={() => cell.isActive && handleCellClick(r, c)}
                                                >
                                                    {isClueStart && clueNumbers.length > 0 && (
                                                        <span className="absolute top-0.5 left-1 text-[10px] text-slate-400 font-medium leading-none">
                                                            {clueNumbers[0]}
                                                        </span>
                                                    )}
                                                    {cell.isActive && (
                                                        <span className={`text-lg font-bold ${cell.isRevealed ? 'text-amber-200' : 'text-white'}`}>
                                                            {cell.letter}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-4">
                                <button
                                    onClick={checkRowOrCol}
                                    disabled={isComplete || !selectedClue}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm transition"
                                >
                                    <Search size={14} />
                                    检查{selectedDirection === 'across' ? '行' : '列'}
                                </button>

                                <div className="relative">
                                    <button
                                        onClick={() => setShowHintMenu(!showHintMenu)}
                                        disabled={isComplete || hintsLeft <= 0}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-amber-400 text-sm transition"
                                    >
                                        <Lightbulb size={14} />
                                        提示 ({hintsLeft})
                                    </button>
                                    <AnimatePresence>
                                        {showHintMenu && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -5 }}
                                                className="absolute bottom-full mb-2 left-0 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden min-w-[180px]"
                                            >
                                                <button
                                                    onClick={handleHintCell}
                                                    disabled={!selectedCell}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-700 text-white text-sm disabled:opacity-40 transition"
                                                >
                                                    揭示当前格首字母
                                                </button>
                                                <button
                                                    onClick={handleHintClue}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-700 text-white text-sm transition"
                                                >
                                                    显示一条完整线索
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <button
                                    onClick={handleReset}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition"
                                >
                                    <RotateCcw size={14} />
                                    重置
                                </button>

                                <button
                                    onClick={handleSubmit}
                                    disabled={!isAllFilled || submitting || isComplete}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition ml-auto"
                                >
                                    <CheckSquare size={14} />
                                    {submitting ? '提交中...' : '提交答案'}
                                </button>
                            </div>

                            {revealedClue && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg"
                                >
                                    <p className="text-amber-300 text-sm">
                                        💡 揭示线索: <span className="font-bold">{revealedClue.word.toUpperCase()}</span>
                                        <span className="text-amber-400 ml-1">({revealedClue.direction === 'across' ? '横' : '纵'})</span>
                                    </p>
                                </motion.div>
                            )}
                        </div>

                        {isComplete && cellResults && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass-panel p-6 rounded-2xl mt-4"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <Trophy size={24} className={cellResults.flat().filter(c => !c.empty).every(c => c.correct) ? 'text-amber-400' : 'text-slate-400'} />
                                    <h3 className="text-xl font-bold text-white">
                                        {cellResults.flat().filter(c => !c.empty).every(c => c.correct) ? '恭喜完成！' : '提交结果'}
                                    </h3>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-slate-800 p-4 rounded-xl text-center">
                                        <Clock size={20} className="text-cyan-400 mx-auto mb-1" />
                                        <div className="text-white font-bold text-lg">{formatTime(elapsedTime)}</div>
                                        <div className="text-slate-400 text-xs">用时</div>
                                    </div>
                                    <div className="bg-slate-800 p-4 rounded-xl text-center">
                                        <Lightbulb size={20} className="text-amber-400 mx-auto mb-1" />
                                        <div className="text-white font-bold text-lg">{hintsUsed}</div>
                                        <div className="text-slate-400 text-xs">提示使用</div>
                                    </div>
                                    <div className="bg-slate-800 p-4 rounded-xl text-center">
                                        <CheckSquare size={20} className="text-emerald-400 mx-auto mb-1" />
                                        <div className="text-white font-bold text-lg">
                                            {cellResults.flat().filter(c => !c.empty && c.correct).length}/{cellResults.flat().filter(c => !c.empty).length}
                                        </div>
                                        <div className="text-slate-400 text-xs">正确</div>
                                    </div>
                                </div>
                                {bestTime !== null && (
                                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                                        <Trophy size={16} className="text-amber-400 inline mr-1" />
                                        <span className="text-amber-300 text-sm">历史最佳: {formatTime(bestTime)} / 使用 {bestHints} 次提示</span>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                        <div className="glass-panel p-5 rounded-2xl">
                            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-5 h-5 rounded bg-cyan-600 text-white text-xs flex items-center justify-center font-bold">横</span>
                                横向提示
                            </h3>
                            <div className="space-y-2">
                                {puzzle.clues_across.map((clue, idx) => (
                                    <button
                                        key={`across-${idx}`}
                                        onClick={() => {
                                            setSelectedClue(clue);
                                            setSelectedDirection('across');
                                            setSelectedCell({ row: clue.row, col: clue.col });
                                        }}
                                        className={`w-full text-left p-3 rounded-lg transition text-sm ${
                                            selectedClue === clue
                                                ? 'bg-cyan-600/20 border border-cyan-500/30 text-white'
                                                : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-transparent'
                                        }`}
                                    >
                                        <span className="font-bold text-cyan-400 mr-2">{idx + 1}.</span>
                                        {clue.clue}
                                        <span className="text-slate-500 ml-1">({clue.word_length})</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="glass-panel p-5 rounded-2xl">
                            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-5 h-5 rounded bg-blue-600 text-white text-xs flex items-center justify-center font-bold">纵</span>
                                纵向提示
                            </h3>
                            <div className="space-y-2">
                                {puzzle.clues_down.map((clue, idx) => (
                                    <button
                                        key={`down-${idx}`}
                                        onClick={() => {
                                            setSelectedClue(clue);
                                            setSelectedDirection('down');
                                            setSelectedCell({ row: clue.row, col: clue.col });
                                        }}
                                        className={`w-full text-left p-3 rounded-lg transition text-sm ${
                                            selectedClue === clue
                                                ? 'bg-blue-600/20 border border-blue-500/30 text-white'
                                                : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-transparent'
                                        }`}
                                    >
                                        <span className="font-bold text-blue-400 mr-2">{idx + 1}.</span>
                                        {clue.clue}
                                        <span className="text-slate-500 ml-1">({clue.word_length})</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {bestTime !== null && !isComplete && (
                            <div className="glass-panel p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                                <div className="flex items-center gap-2 text-sm">
                                    <Trophy size={16} className="text-amber-400" />
                                    <span className="text-amber-300">历史最佳: {formatTime(bestTime)}</span>
                                    {bestHints !== null && (
                                        <span className="text-slate-500">/ {bestHints} 次提示</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showCelebration && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                        onClick={() => setShowCelebration(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ type: 'spring', duration: 0.6 }}
                            className="glass-panel bg-slate-900 p-10 rounded-3xl w-full max-w-md text-center"
                            onClick={e => e.stopPropagation()}
                        >
                            <motion.div
                                animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, -10, 0],
                                }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="text-7xl mb-6"
                            >
                                🎉
                            </motion.div>

                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 mb-3">
                                    完美通关！
                                </h2>
                                <p className="text-slate-300 mb-6">所有单词全部正确！</p>
                            </motion.div>

                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="grid grid-cols-2 gap-4 mb-6"
                            >
                                <div className="bg-slate-800 p-4 rounded-xl">
                                    <Clock size={24} className="text-cyan-400 mx-auto mb-2" />
                                    <div className="text-white font-bold text-xl">{formatTime(elapsedTime)}</div>
                                    <div className="text-slate-400 text-sm">用时</div>
                                </div>
                                <div className="bg-slate-800 p-4 rounded-xl">
                                    <Lightbulb size={24} className="text-amber-400 mx-auto mb-2" />
                                    <div className="text-white font-bold text-xl">{hintsUsed}</div>
                                    <div className="text-slate-400 text-sm">提示使用</div>
                                </div>
                            </motion.div>

                            {bestTime !== null && elapsedTime <= bestTime && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.7, type: 'spring' }}
                                    className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl"
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <Sparkles size={18} className="text-amber-400" />
                                        <span className="text-amber-300 font-bold">新纪录！</span>
                                        <Sparkles size={18} className="text-amber-400" />
                                    </div>
                                </motion.div>
                            )}

                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.8 }}
                                className="space-y-3"
                            >
                                <button
                                    onClick={() => setShowCelebration(false)}
                                    className="btn-primary w-full py-3 text-lg"
                                >
                                    查看详情
                                </button>
                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition"
                                >
                                    返回首页
                                </button>
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CrosswordPage;
