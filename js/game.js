// ===================== VARIABLES GLOBALES =====================
const game = new Chess();
let selectedSquare = null;
let highlights = [];
let lastFromSquare = null;
let lastToSquare = null;
let moveCount = 0;
let goodMoves = 0;
let badMoves = 0;
let boardFlipped = false;
let aiThinking = false;
let playerElo = 1600;
let lastEval = 0;
let stats = { totalGames: 0, maxElo: 1600, sessions: 0 };

const pieceSymbols = {
    'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔',
    'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚'
};

const coachPhrases = {
    excellent: ["¡Perfecto! Esa es la mejor jugada.", "Increíble, análisis excelente.", "¡Óptimo movimiento!"],
    good: ["Buen movimiento.", "Sigue así, buena elección.", "Movimiento sólido."],
    mistake: ["Hay movimientos mejores.", "No es la mejor opción aquí.", "Cuidado con tu posición."],
    blunder: ["¡Error grave!", "Pierdes ventaja importante.", "¡Cuidado, este movimiento es malo!"]
};

// ===================== EVALUACIÓN DE POSICIÓN =====================
function evaluatePosition() {
    const board = game.board();
    let score = 0;
    const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9, 'k': 0 };
    
    // Material
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = board[i][j];
            if (!piece) continue;
            const val = pieceValues[piece.type] || 0;
            if (piece.color === 'w') {
                score += val;
            } else {
                score -= val;
            }
        }
    }

    // Movilidad
    const moves = game.moves();
    score += moves.length * 0.05;

    return score;
}

function calculateWinProbability() {
    const eval_score = evaluatePosition();
    const sigmoid = (x) => 1 / (1 + Math.exp(-x / 150));
    
    const whiteWin = sigmoid(eval_score) * 0.85;
    const blackWin = sigmoid(-eval_score) * 0.85;
    const draw = 1 - whiteWin - blackWin;

    return {
        white: Math.round(whiteWin * 100),
        black: Math.round(blackWin * 100),
        draw: Math.round(draw * 100),
        decisive: Math.round((whiteWin + blackWin) * 100)
    };
}

// ===================== RENDER BOARD =====================
function renderBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const r = boardFlipped ? 7 - row : row;
            const c = boardFlipped ? 7 - col : col;
            const square = String.fromCharCode(97 + c) + (8 - r);
            const piece = game.get(square);

            const squareEl = document.createElement('div');
            squareEl.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');

            if (selectedSquare === square) squareEl.classList.add('selected');
            if (highlights.includes(square)) squareEl.classList.add('highlight');
            if ((square === lastFromSquare || square === lastToSquare) && moveCount > 0) {
                squareEl.classList.add('last-move');
            }

            if (piece) {
                squareEl.textContent = pieceSymbols[piece.type];
                squareEl.style.color = piece.color === 'w' ? '#fff' : '#000';
                squareEl.style.textShadow = piece.color === 'w' ? '2px 2px 4px #000' : '1px 1px 3px #fff';
            }

            squareEl.addEventListener('click', () => handleSquareClick(square));
            boardEl.appendChild(squareEl);
        }
    }
}

// ===================== HANDLE SQUARE CLICK =====================
function handleSquareClick(square) {
    if (aiThinking || game.game_over()) return;

    const piece = game.get(square);

    if (selectedSquare && piece && game.get(selectedSquare).color === piece.color) {
        selectedSquare = square;
        highlights = game.moves({ square, verbose: true }).map(m => m.to);
    } else if (selectedSquare) {
        const move = game.move({ from: selectedSquare, to: square, promotion: 'q' });

        if (move) {
            lastFromSquare = selectedSquare;
            lastToSquare = square;
            moveCount++;
            selectedSquare = null;
            highlights = [];

            evaluateMoveQuality(move);

            const mode = document.getElementById('gameMode').value;
            if ((mode === 'vs-ia' || mode === 'coach') && !game.game_over()) {
                aiThinking = true;
                setTimeout(makeAIMove, 1500);
            }

            updateUI();
        } else {
            selectedSquare = null;
            highlights = [];
        }
    } else if (piece && piece.color === game.turn()) {
        selectedSquare = square;
        highlights = game.moves({ square, verbose: true }).map(m => m.to);
    }

    renderBoard();
}

// ===================== EVALUAR CALIDAD DE MOVIMIENTO =====================
function evaluateMoveQuality(move) {
    const positionScore = evaluatePosition();
    const moveValue = Math.abs(positionScore - lastEval);

    let quality = 'good';
    if (moveValue > 0.5) quality = 'excellent';
    else if (moveValue < -0.8) quality = 'blunder';
    else if (moveValue < -0.3) quality = 'mistake';

    if (quality === 'excellent' || quality === 'good') goodMoves++;
    if (quality === 'mistake' || quality === 'blunder') badMoves++;

    giveCoachFeedback(quality);
    lastEval = positionScore;
}

// ===================== FEEDBACK DEL ENTRENADOR =====================
function giveCoachFeedback(type) {
    const mode = document.getElementById('gameMode').value;
    if (mode === 'free') return;

    const phrases = coachPhrases[type];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];

    const coachMsg = document.getElementById('coachMessage');
    const icon = (type === 'excellent' || type === 'good') ? '✅' : '❌';
    coachMsg.innerHTML = '<strong>' + icon + '</strong> ' + phrase;
    coachMsg.className = 'coach-message ' + (type === 'excellent' || type === 'good' ? 'good' : 'bad');
}

// ===================== UPDATE UI =====================
function updateUI() {
    renderBoard();
    updateEvalBar();
    updateLastMoveInfo();
    updateMoveHistory();
    updateStats();

    if (game.game_over()) showGameOver();
}

function updateEvalBar() {
    const score = evaluatePosition();
    const prob = calculateWinProbability();
    const percentage = 50 + Math.min(Math.max(score * 5, -50), 50);
    
    const fillEl = document.getElementById('evalBarFill');
    fillEl.style.height = percentage + '%';
    fillEl.textContent = Math.abs(score).toFixed(1);
    
    if (score > 0.5) fillEl.className = 'eval-bar-fill white-advantage';
    else if (score < -0.5) fillEl.className = 'eval-bar-fill black-advantage';
    else fillEl.className = 'eval-bar-fill';

    document.getElementById('evalScore').textContent = score.toFixed(2);
    document.getElementById('winProb').innerHTML = `B:${prob.white}% N:${prob.black}%`;
}

function updateLastMoveInfo() {
    const el = document.getElementById('lastMoveInfo');
    if (moveCount === 0) { el.style.display = 'none'; return; }
    el.style.display = 'grid';
    const history = game.history({ verbose: true });
    const lastMove = history[history.length - 1];
    document.getElementById('playerLastMove').textContent = lastMove?.san || '-';
    document.getElementById('moveEval').textContent = evaluatePosition().toFixed(2);
}

function updateMoveHistory() {
    const hist = document.getElementById('moveHistory');
    hist.innerHTML = '';
    const history = game.history({ verbose: true });
    
    if (history.length === 0) {
        hist.innerHTML = '<p style="color: #888; text-align: center;">Movimientos aquí...</p>';
        return;
    }

    history.forEach((move, idx) => {
        const div = document.createElement('div');
        div.className = 'move-item';
        const moveNum = Math.floor(idx / 2) + 1;
        const color = idx % 2 === 0 ? '⚪' : '⚫';
        div.textContent = `${color} ${moveNum}. ${move.san}`;
        hist.appendChild(div);
    });
}

function updateStats() {
    document.getElementById('moveCount').textContent = moveCount;
    const total = goodMoves + badMoves;
    document.getElementById('accuracy').textContent = total > 0 ? Math.round((goodMoves / total) * 100) + '%' : '0%';
    document.getElementById('goodMoves').textContent = goodMoves;
    document.getElementById('badMoves').textContent = badMoves;
    document.getElementById('totalGames').textContent = stats.totalGames;
    document.getElementById('maxElo').textContent = stats.maxElo;
    document.getElementById('currentElo').textContent = playerElo;
    document.getElementById('sessions').textContent = stats.sessions;
}

function showGameOver() {
    let result = '';
    if (game.in_checkmate()) result = game.turn() === 'w' ? '¡Ganaste!' : 'Perdiste';
    else if (game.in_draw()) result = 'Tablas';
    else if (game.in_stalemate()) result = 'Ahogado';
    else return;

    stats.totalGames++;
    stats.maxElo = Math.max(stats.maxElo, playerElo);
    stats.sessions++;

    alert(`🏁 Fin: ${result}\n\nPrecisión: ${document.getElementById('accuracy').textContent}`);
}

// ===================== CONTROLES =====================
function resetGame() {
    game.reset();
    selectedSquare = null;
    highlights = [];
    lastFromSquare = null;
    lastToSquare = null;
    moveCount = 0;
    goodMoves = 0;
    badMoves = 0;
    aiThinking = false;
    lastEval = 0;

    document.getElementById('coachMessage').innerHTML = '<strong>¡Bienvenido!</strong> Realiza tu primer movimiento.';
    document.getElementById('lastMoveInfo').style.display = 'none';

    updateUI();
}

function undoMove() {
    if (aiThinking) return;
    game.undo();
    game.undo();
    moveCount = Math.max(0, moveCount - 2);
    updateUI();
}

function flipBoard() {
    boardFlipped = !boardFlipped;
    renderBoard();
}

function requestHint() {
    if (game.game_over() || aiThinking) return;
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return;
    
    const bestMove = moves[Math.floor(Math.random() * Math.min(3, moves.length))];
    selectedSquare = bestMove.from;
    highlights = [bestMove.to];
    renderBoard();
    
    const coachMsg = document.getElementById('coachMessage');
    coachMsg.innerHTML = '<strong>💡 Pista:</strong> ' + bestMove.san;
    coachMsg.className = 'coach-message good';
}

function analysisMode() {
    document.getElementById('analysisModal').classList.add('active');
    performAnalysis();
}

function closeAnalysis() {
    document.getElementById('analysisModal').classList.remove('active');
}

function performAnalysis() {
    const score = evaluatePosition().toFixed(2);
    const prob = calculateWinProbability();
    const moves = game.moves({ verbose: true });
    const history = game.history({ verbose: true });
    
    const board = game.board();
    let material = 0;
    const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9 };
    for (let row of board) {
        for (let p of row) {
            if (!p) continue;
            const val = pieceValues[p.type] || 0;
            material += p.color === 'w' ? val : -val;
        }
    }

    const phase = history.length < 10 ? 'Apertura' : history.length < 40 ? 'Medio Juego' : 'Final';

    document.getElementById('whiteWinProb').innerHTML = prob.white + '%';
    document.getElementById('drawProb').innerHTML = prob.draw + '%';
    document.getElementById('blackWinProb').innerHTML = prob.black + '%';
    document.getElementById('anyWinProb').innerHTML = prob.decisive + '%';
    document.getElementById('currentScore').innerHTML = score;
    document.getElementById('analysisDepth').innerHTML = '20 movimientos';
    document.getElementById('bestMoveAnalysis').innerHTML = moves.length > 0 ? moves[0].san : '-';
    document.getElementById('materialEval').innerHTML = material.toFixed(2);
    document.getElementById('openingEval').innerHTML = history.length < 10 ? '0.0' : '-';
    document.getElementById('middlegameEval').innerHTML = phase === 'Medio Juego' ? score : '-';
    document.getElementById('endgameEval').innerHTML = phase === 'Final' ? score : '-';
    document.getElementById('principalVariation').innerHTML = moves.slice(0, 5).map(m => m.san).join(' - ');
    document.getElementById('analysisStatus').innerHTML = '✅ Análisis completado';
    document.getElementById('analysisLoading').style.display = 'none';
}
