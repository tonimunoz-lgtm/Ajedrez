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

let lastEvalBeforeMove = 0;

let stats = {
    totalGames: 0,
    maxElo: 1600,
    sessions: 0
};

const pieceSymbols = {
    'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚',
    'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔'
};

const coachPhrases = {
    excellent: ["¡Perfecto! Esa es la mejor jugada.", "Movimiento de gran nivel.", "¡Excelente decisión!"],
    good: ["Buen movimiento.", "Sólido y correcto.", "Vas por buen camino."],
    mistake: ["Había opciones mejores.", "Cuidado con la posición.", "Movimiento impreciso."],
    blunder: ["¡Error grave!", "Pierdes mucha ventaja.", "Esto cambia la partida."]
};

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

// ===================== INTERACCIÓN =====================
function handleSquareClick(square) {
    if (aiThinking || game.game_over()) return;

    const piece = game.get(square);

    // Seleccionar otra pieza propia
    if (selectedSquare && piece && piece.color === game.turn()) {
        selectedSquare = square;
        highlights = game.moves({ square, verbose: true }).map(m => m.to);
        renderBoard();
        return;
    }

    // Intentar mover
    if (selectedSquare) {
        lastEvalBeforeMove = currentEval;

        const move = game.move({ from: selectedSquare, to: square, promotion: 'q' });

        selectedSquare = null;
        highlights = [];

        if (move) {
            lastFromSquare = move.from;
            lastToSquare = move.to;
            moveCount++;

            classifyMoveQuality();

            const mode = document.getElementById('gameMode').value;
            if ((mode === 'vs-ia' || mode === 'coach') && !game.game_over()) {
                makeAIMove();
            }
        }

        updateUI();
        return;
    }

    // Seleccionar pieza
    if (piece && piece.color === game.turn()) {
        selectedSquare = square;
        highlights = game.moves({ square, verbose: true }).map(m => m.to);
        renderBoard();
    }
}

// ===================== CALIDAD DE JUGADA =====================
function classifyMoveQuality() {
    const diff = currentEval - lastEvalBeforeMove;
    let quality = 'good';

    if (diff > 0.6) quality = 'excellent';
    else if (diff < -1.2) quality = 'blunder';
    else if (diff < -0.4) quality = 'mistake';

    if (quality === 'excellent' || quality === 'good') goodMoves++;
    if (quality === 'mistake' || quality === 'blunder') badMoves++;

    giveCoachFeedback(quality);
}

// ===================== FEEDBACK ENTRENADOR =====================
function giveCoachFeedback(type) {
    const mode = document.getElementById('gameMode').value;
    if (mode === 'free') return;

    const phrases = coachPhrases[type];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    const coachMsg = document.getElementById('coachMessage');

    coachMsg.innerHTML = `<strong>${type.toUpperCase()}:</strong> ${phrase}`;
    coachMsg.className = 'coach-message ' + (type === 'excellent' || type === 'good' ? 'good' : 'bad');
}

// ===================== UI =====================
function updateUI() {
    renderBoard();
    updateEvalBar();
    updateLastMoveInfo();
    updateMoveHistory();
    updateStats();

    if (game.game_over()) showGameOver();
}

function updateEvalBar() {
    const score = currentEval;
    const percentage = 50 + Math.min(Math.max(score * 5, -50), 50);

    const fill = document.getElementById('evalBarFill');
    fill.style.height = percentage + '%';
    fill.textContent = score.toFixed(2);

    fill.className = 'eval-bar-fill';
    if (score > 0.5) fill.classList.add('white-advantage');
    if (score < -0.5) fill.classList.add('black-advantage');

    document.getElementById('evalScore').textContent = score.toFixed(2);
}

function updateLastMoveInfo() {
    const el = document.getElementById('lastMoveInfo');
    if (moveCount === 0) return;

    const history = game.history({ verbose: true });
    const last = history[history.length - 1];
    document.getElementById('playerLastMove').textContent = last?.san || '-';
    document.getElementById('moveEval').textContent = currentEval.toFixed(2);
}

function updateMoveHistory() {
    const hist = document.getElementById('moveHistory');
    hist.innerHTML = '';

    game.history({ verbose: true }).forEach((m, i) => {
        const div = document.createElement('div');
        div.className = 'move-item';
        div.textContent = `${i + 1}. ${m.san}`;
        hist.appendChild(div);
    });
}

function updateStats() {
    document.getElementById('moveCount').textContent = moveCount;
    const total = goodMoves + badMoves;
    document.getElementById('accuracy').textContent =
        total ? Math.round((goodMoves / total) * 100) + '%' : '0%';

    document.getElementById('goodMoves').textContent = goodMoves;
    document.getElementById('badMoves').textContent = badMoves;
    document.getElementById('totalGames').textContent = stats.totalGames;
    document.getElementById('maxElo').textContent = stats.maxElo;
    document.getElementById('sessions').textContent = stats.sessions;
}

// ===================== FIN DE PARTIDA =====================
function showGameOver() {
    let result = 'Tablas';
    if (game.in_checkmate()) result = game.turn() === 'w' ? 'Perdiste' : '¡Ganaste!';

    stats.totalGames++;
    stats.sessions++;

    alert(`🏁 ${result}\nPrecisión: ${document.getElementById('accuracy').textContent}`);
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

    document.getElementById('coachMessage').innerHTML =
        '<strong>¡Nueva partida!</strong> Juega tu primer movimiento.';

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
