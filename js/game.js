// js/game.js  
  
// ===================== VARIABLES GLOBALES =====================  
const game = new Chess(); // Instancia principal del juego Chess.js  
let selectedSquare = null; // Cuadrado actualmente seleccionado por el jugador  
let highlights = []; // Cuadrados a resaltar (movimientos legales, selección)  
let lastFromSquare = null; // Origen del último movimiento  
let lastToSquare = null; // Destino del último movimiento  
let moveCount = 0; // Contador de movimientos  
let goodMoves = 0; // Contador de movimientos 'buenos' del jugador  
let badMoves = 0; // Contador de movimientos 'malos' del jugador  
let boardFlipped = false; // Estado del tablero (true si está girado)  
let aiThinking = false; // Bandera para indicar si la IA está pensando  
let playerElo = 1600; // ELO actual del jugador  
let currentStockfishScore = 0; // Almacena la última evaluación de Stockfish (desde la perspectiva de las blancas)  
  
// Variables de estadísticas (ejemplo, se pueden cargar/guardar en localStorage)  
let stats = { totalGames: 0, maxElo: 1600, sessions: 0 };  
  
// Símbolos de piezas para la visualización del tablero  
const pieceSymbols = {  
    'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔',  
    'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚'  
};  
  
// Frases del entrenador para diferentes tipos de jugadas  
const coachPhrases = {  
    excellent: ["¡Perfecto! Esa es la mejor jugada.", "Increíble, análisis excelente.", "¡Óptimo movimiento!"],  
    good: ["Buen movimiento.", "Sigue así, buena elección.", "Movimiento sólido."],  
    mistake: ["Hay movimientos mejores.", "No es la mejor opción aquí.", "Cuidado con tu posición."],  
    blunder: ["¡Error grave!", "Pierdes ventaja importante.", "¡Cuidado, este movimiento es malo!"],  
    hint: ["Considera este movimiento:", "Una buena opción podría ser:", "Analiza esta jugada:"],  
    aiMove: ["La IA ha realizado su movimiento.", "Turno de la IA completado.", "Movimiento de la máquina."] // Nuevo mensaje para la IA  
};  
  
  
// ===================== EVALUACIÓN LOCAL (FALLBACK) =====================  
  
/**  
 * Función de evaluación heurística local, usada como fallback si Stockfish no está disponible.  
 * Ahora esta función no tiene un cuerpo, ya que la evaluación se delega a stockfish-ai.js (que usa el worker).  
 * Se mantiene por compatibilidad si se llamara directamente desde game.js y no se exportara evaluatePositionLocal.  
 * Para el análisis, usaremos window.evaluatePositionLocal que es la versión del hilo principal en stockfish-ai.js.  
 */  
function _internalEvaluatePosition() {  
    console.warn("Llamada a _internalEvaluatePosition, se recomienda usar window.evaluatePositionLocal en su lugar.");  
    return window.evaluatePositionLocal ? window.evaluatePositionLocal(game) : 0;  
}  
  
/**  
 * Calcula las probabilidades de victoria para blancas, negras y tablas basándose en el score de Stockfish.  
 * Utiliza una función logística ajustada para mapear el score a probabilidades.  
 * @param {number} score - El score de la posición en centipeones (positivo para blancas).  
 * @returns {object} Un objeto con las probabilidades en porcentaje.  
 */  
function calculateWinProbability(score) {  
    const k = 0.00368208;  
    const whiteProb = 1 / (1 + Math.exp(-k * score));  
  
    let drawProb = 0.0;  
    if (Math.abs(score) < 100) {  
        drawProb = 0.2 + (1 - whiteProb - (1 - whiteProb)) * 0.5;  
        drawProb = Math.min(0.5, Math.max(0.05, drawProb));  
    }  
  
    const blackProb = 1 - whiteProb - drawProb;  
  
    return {  
        white: Math.round(whiteProb * 100),  
        black: Math.round(blackProb * 100),  
        draw: Math.round(drawProb * 100),  
        decisive: Math.round((whiteProb + blackProb) * 100)  
    };  
}  
  
  
// ===================== RENDERIZADO DEL TABLERO =====================  
  
/**  
 * Renderiza el tablero de ajedrez en el elemento HTML 'board'.  
 * Dibuja cuadrados, piezas y aplica resaltados de selección/movimientos.  
 */  
function renderBoard() {  
    const boardEl = document.getElementById('board');  
    if (!boardEl) {  
        console.error("Elemento 'board' no encontrado.");  
        return;  
    }  
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
                squareEl.style.textShadow = piece.color === 'w' ? '2px 2px 4px rgba(0,0,0,0.7)' : '1px 1px 3px rgba(255,255,255,0.7)';  
            }  
  
            squareEl.addEventListener('click', () => handleSquareClick(square));  
            boardEl.appendChild(squareEl);  
        }  
    }  
}  
  
  
// ===================== MANEJO DE CLICS EN CUADRADOS =====================  
  
/**  
 * Maneja el evento de click en un cuadrado del tablero.  
 * Gestiona la selección de piezas, movimientos y la interacción con la IA.  
 * @param {string} square - La notación del cuadrado donde se hizo clic (ej. "e2").  
 */  
async function handleSquareClick(square) {  
    if (aiThinking || game.game_over()) return;  
  
    const pieceOnClickedSquare = game.get(square);  
    const mode = document.getElementById('gameMode').value;  
  
    if (selectedSquare) {  
        const selectedPiece = game.get(selectedSquare);  
  
        if (pieceOnClickedSquare && selectedPiece.color === pieceOnClickedSquare.color) {  
            selectedSquare = square;  
            highlights = game.moves({ square, verbose: true }).map(m => m.to);  
        } else {  
            const tempMove = { from: selectedSquare, to: square, promotion: 'q' };  
            const move = game.move(tempMove);  
  
            if (move) {  
                lastFromSquare = selectedSquare;  
                lastToSquare = square;  
                moveCount++;  
                selectedSquare = null;  
                highlights = [];  
  
                if (mode === 'coach' || mode === 'vs-ia') {  
                    await evaluateMoveQuality(move);  
                }  
  
                if ((mode === 'vs-ia' || mode === 'coach') && !game.game_over()) {  
                    aiThinking = true;  
                    document.getElementById('coachMessage').innerHTML = '<strong>Pensando...</strong> <span class="loading"></span>';  
                    document.getElementById('coachMessage').classList.remove('good', 'bad', 'hint', 'neutral');  
  
                    // No usamos setTimeout aquí, esperamos la respuesta del worker directamente  
                    try {  
                        const aiMove = await window.makeAIMove(); // Obtener movimiento de la IA (del worker)  
  
                        if (aiMove) {  
                            game.move(aiMove);  
                            lastFromSquare = aiMove.from;  
                            lastToSquare = aiMove.to;  
                            moveCount++;  
                            giveCoachFeedback('aiMove'); // Feedback inmediato de que la IA se movió  
                        } else {  
                            console.error("La IA no pudo hacer un movimiento o el juego terminó.");  
                            giveCoachFeedback('bad', "La IA no pudo hacer un movimiento.");  
                        }  
                    } catch (e) {  
                        console.error("Error en el cálculo de la IA:", e);  
                        giveCoachFeedback('bad', "La IA tuvo un error al calcular su movimiento.");  
                    } finally {  
                        aiThinking = false;  
                        updateUI();  
                    }  
                } else {  
                    updateUI();  
                }  
            } else {  
                selectedSquare = null;  
                highlights = [];  
            }  
        }  
    } else if (pieceOnClickedSquare && pieceOnClickedSquare.color === game.turn()) {  
        selectedSquare = square;  
        highlights = game.moves({ square, verbose: true }).map(m => m.to);  
    } else {  
        selectedSquare = null;  
        highlights = [];  
    }  
  
    renderBoard();  
}  
  
  
// ===================== EVALUAR CALIDAD DE MOVIMIENTO (CON STOCKFISH) =====================  
  
/**  
 * Evalúa la calidad del último movimiento del jugador utilizando Stockfish.  
 * @param {object} playerMove - El objeto de movimiento de chess.js que el jugador acaba de realizar.  
 */  
async function evaluateMoveQuality(playerMove) {  
    if (!window.engineReady) {  
        giveCoachFeedback('good', "Stockfish no cargado, evaluación local.");  
        return;  
    }  
  
    const playerColor = playerMove.color;  
  
    // Deshacer y evaluar posición anterior  
    game.undo();  
    const prevEvalResult = await window.evaluateWithStockfish(10);  
    const prevScore = prevEvalResult.score;  
  
    // Rehacer y evaluar posición actual  
    game.move(playerMove);  
    const currentEvalResult = await window.evaluateWithStockfish(10);  
    const currentScore = currentEvalResult.score;  
  
    currentStockfishScore = currentEvalResult.score;  
  
    let scoreDifference;  
    if (playerColor === 'w') {  
        scoreDifference = currentScore - prevScore;  
    } else {  
        scoreDifference = prevScore - currentScore;  
    }  
  
    let quality = 'good';  
    if (scoreDifference > 100) {  
        quality = 'excellent';  
    } else if (scoreDifference > 20) {  
        quality = 'good';  
    } else if (scoreDifference < -20 && scoreDifference >= -80) {  
        quality = 'mistake';  
    } else if (scoreDifference < -80) {  
        quality = 'blunder';  
    } else {  
        quality = 'good';  
    }  
  
    if (quality === 'excellent' || quality === 'good') goodMoves++;  
    if (quality === 'mistake' || quality === 'blunder') badMoves++;  
  
    giveCoachFeedback(quality);  
}  
  
  
// ===================== FEEDBACK DEL ENTRENADOR =====================  
  
/**  
 * Muestra un mensaje de feedback al jugador en el elemento 'coachMessage'.  
 * @param {string} type - Tipo de feedback (ej. 'excellent', 'good', 'mistake', 'blunder', 'hint', 'aiMove').  
 * @param {string} [message=null] - Mensaje específico a mostrar. Si es null, se elige una frase aleatoria.  
 */  
function giveCoachFeedback(type, message = null) {  
    const mode = document.getElementById('gameMode').value;  
    if (mode === 'free') return;  
  
    const phrases = coachPhrases[type];  
    const phrase = message || phrases[Math.floor(Math.random() * phrases.length)];  
  
    const coachMsg = document.getElementById('coachMessage');  
    if (!coachMsg) {  
        console.error("Elemento 'coachMessage' no encontrado.");  
        return;  
    }  
  
    let icon = '';  
    let className = 'coach-message';  
  
    if (type === 'excellent' || type === 'good' || type === 'aiMove') {  
        icon = '✅';  
        className += ' good';  
    } else if (type === 'mistake' || type === 'blunder') {  
        icon = '❌';  
        className += ' bad';  
    } else if (type === 'hint') {  
        icon = '💡';  
        className += ' hint';  
    } else if (type === 'neutral') {  
        icon = '🤝';  
        className += ' neutral';  
    }  
  
    coachMsg.innerHTML = `<strong>${icon}</strong> ${phrase}`;  
    coachMsg.className = className;  
}  
  
  
// ===================== ACTUALIZACIÓN DE LA INTERFAZ DE USUARIO =====================  
  
/**  
 * Actualiza todos los componentes de la interfaz de usuario.  
 */  
async function updateUI() {  
    renderBoard();  
    await window.updateEvaluationDisplay();  
    updateLastMoveInfo();  
    updateMoveHistory();  
    updateStats();  
  
    if (game.game_over()) {  
        showGameOver();  
    }  
}  
  
/**  
 * Actualiza visualmente la barra de evaluación vertical y el score numérico.  
 * @param {number} score - El score de Stockfish actual de la posición (en centipeones, positivo para blancas).  
 */  
function updateEvalBar(score) {  
    const prob = calculateWinProbability(score);  
  
    const maxScore = 1000;  
    const scoreForBar = game.turn() === 'b' ? -score : score;  
  
    let percentage = 50 + (scoreForBar / (maxScore * 2)) * 100;  
    percentage = Math.min(100, Math.max(0, percentage));  
  
    const fillEl = document.getElementById('evalBarFill');  
    if(fillEl) {  
        fillEl.style.height = percentage + '%';  
        fillEl.textContent = (Math.abs(score) / 100).toFixed(1);  
        fillEl.className = 'eval-bar-fill';  
        if (score > 50) {  
            fillEl.classList.add('white-advantage');  
        } else if (score < -50) {  
            fillEl.classList.add('black-advantage');  
        }  
    } else {  
        console.warn("Elemento 'evalBarFill' no encontrado.");  
    }  
  
    const evalScoreEl = document.getElementById('evalScore');  
    if(evalScoreEl) {  
        evalScoreEl.textContent = (score / 100).toFixed(2);  
    } else {  
        console.warn("Elemento 'evalScore' no encontrado.");  
    }  
  
    const winProbEl = document.getElementById('winProb');  
    if(winProbEl) {  
        winProbEl.innerHTML = `B:${prob.white}% N:${prob.black}%`;  
    } else {  
        console.warn("Elemento 'winProb' no encontrado.");  
    }  
}  
  
/**  
 * Actualiza la información del último movimiento del jugador.  
 */  
function updateLastMoveInfo() {  
    const el = document.getElementById('lastMoveInfo');  
    if (!el) {  
        console.warn("Elemento 'lastMoveInfo' no encontrado.");  
        return;  
    }  
  
    if (moveCount === 0) {  
        el.style.display = 'none';  
        return;  
    }  
  
    el.style.display = 'grid';  
    const history = game.history({ verbose: true });  
    const lastMove = history[history.length - 1];  
  
    const playerLastMoveEl = document.getElementById('playerLastMove');  
    if (playerLastMoveEl) {  
        playerLastMoveEl.textContent = lastMove?.san || '-';  
    } else {  
        console.warn("Elemento 'playerLastMove' no encontrado.");  
    }  
  
    const moveEvalEl = document.getElementById('moveEval');  
    if (moveEvalEl) {  
        moveEvalEl.textContent = (currentStockfishScore / 100).toFixed(2);  
    } else {  
        console.warn("Elemento 'moveEval' no encontrado.");  
    }  
}  
  
/**  
 * Actualiza el historial de movimientos en el panel lateral.  
 */  
function updateMoveHistory() {  
    const historyEl = document.getElementById('moveHistory');  
    if (!historyEl) {  
        console.warn("Elemento 'moveHistory' no encontrado.");  
        return;  
    }  
  
    historyEl.innerHTML = '';  
    const history = game.history();  
  
    if (history.length === 0) {  
        historyEl.innerHTML = '<p style="color: #888; text-align: center;">Movimientos aquí...</p>';  
        return;  
    }  
  
    let moveNum = 1;  
    let turnMoves = '';  
    for (let i = 0; i < history.length; i++) {  
        if (i % 2 === 0) {  
            if (i > 0) {  
                historyEl.innerHTML += `<div class="move-item">${moveNum-1}. ${turnMoves}</div>`;  
            }  
            turnMoves = `${history[i]}`;  
            moveNum++;  
        } else {  
            turnMoves += ` ${history[i]}`;  
        }  
    }  
    historyEl.innerHTML += `<div class="move-item">${moveNum-1}. ${turnMoves}</div>`;  
  
    historyEl.scrollTop = historyEl.scrollHeight;  
}  
  
/**  
 * Actualiza las estadísticas rápidas del juego.  
 */  
function updateStats() {  
    const moveCountEl = document.getElementById('moveCount');  
    if (moveCountEl) moveCountEl.textContent = moveCount;  
  
    const totalGamesEl = document.getElementById('totalGames');  
    if (totalGamesEl) totalGamesEl.textContent = stats.totalGames;  
    const maxEloEl = document.getElementById('maxElo');  
    if (maxEloEl) maxEloEl.textContent = stats.maxElo;  
    const currentEloEl = document.getElementById('currentElo');  
    if (currentEloEl) currentEloEl.textContent = playerElo;  
    const sessionsEl = document.getElementById('sessions');  
    if (sessionsEl) sessionsEl.textContent = stats.sessions;  
}  
  
/**  
 * Muestra el mensaje de Game Over cuando la partida finaliza.  
 */  
function showGameOver() {  
    let message = '';  
    let className = 'good';  
  
    if (game.in_checkmate()) {  
        message = `¡Jaque Mate! ${game.turn() === 'w' ? 'Negras' : 'Blancas'} ganan.`;  
        className = 'bad';  
    } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition() || game.insufficient_material()) {  
        message = "¡Tablas!";  
        className = 'neutral';  
    }  
    const coachMsg = document.getElementById('coachMessage');  
    if (coachMsg) {  
        coachMsg.innerHTML = `<strong>Game Over!</strong> ${message}`;  
        coachMsg.className = `coach-message ${className}`;  
    }  
}  
  
  
// ===================== CONTROLES DEL JUEGO =====================  
  
/**  
 * Reinicia el juego a la posición inicial.  
 */  
async function resetGame() {  
    game.reset();  
    selectedSquare = null;  
    highlights = [];  
    lastFromSquare = null;  
    lastToSquare = null;  
    moveCount = 0;  
    goodMoves = 0;  
    badMoves = 0;  
    boardFlipped = false;  
    aiThinking = false;  
    currentStockfishScore = 0;  
  
    const coachMsg = document.getElementById('coachMessage');  
    if (coachMsg) {  
        coachMsg.innerHTML = '<strong>¡Bienvenido!</strong> Realiza tu primer movimiento.';  
        coachMsg.classList.remove('good', 'bad', 'hint', 'neutral');  
    }  
    const lastMoveInfoEl = document.getElementById('lastMoveInfo');  
    if (lastMoveInfoEl) lastMoveInfoEl.style.display = 'none';  
  
    await window.updateEvaluationDisplay();  
    updateUI();  
}  
  
/**  
 * Deshace los últimos movimientos (del jugador y de la IA si aplica).  
 */  
async function undoMove() {  
    if (aiThinking) return;  
  
    game.undo();  
    if (game.history().length > 0) {  
        game.undo();  
    }  
    moveCount = game.history().length;  
  
    selectedSquare = null;  
    highlights = [];  
  
    await window.updateEvaluationDisplay();  
    updateUI();  
}  
  
/**  
 * Gira el tablero para cambiar la perspectiva del jugador.  
 */  
function flipBoard() {  
    boardFlipped = !boardFlipped;  
    renderBoard();  
}  
  
/**  
 * Solicita una pista a Stockfish para el mejor movimiento en la posición actual.  
 */  
async function requestHint() {  
    if (game.game_over() || aiThinking) return;  
  
    if (!window.engineReady) {  
        giveCoachFeedback('hint', "Stockfish no está cargado. No puedo dar una pista precisa.");  
        return;  
    }  
  
    giveCoachFeedback('hint', 'Pensando en la mejor pista... <span class="loading"></span>');  
    aiThinking = true;  
  
    const difficultyElem = document.getElementById('difficulty');  
    const difficulty = difficultyElem ? parseInt(difficultyElem.value) : 3;  
    const hintDepth = difficulty * 3 + 6;  
    const hintTimeout = 5000;  
  
    try {  
        const result = await window.evaluateWithStockfish(hintDepth, hintTimeout);  
  
        aiThinking = false;  
  
        if (result.bestMove) {  
            const from = result.bestMove.substring(0, 2);  
            const to = result.bestMove.substring(2, 4);  
            selectedSquare = from;  
            highlights = [to];  
            renderBoard();  
  
            let pvHintSan = '';  
            if (result.pv && result.pv.length > 0) {  
                pvHintSan = convertPvUciToSan(result.pv, game.fen());  
            }  
  
            giveCoachFeedback('hint', `Considera mover ${from}-${to}. PV: ${pvHintSan || 'N/A'}`);  
        } else {  
            giveCoachFeedback('hint', "No pude encontrar una buena pista. ¿Hay un error?");  
        }  
    } catch (e) {  
        console.error("Error al solicitar pista:", e);  
        giveCoachFeedback('bad', "Ocurrió un error al procesar la pista.");  
    } finally {  
        aiThinking = false; // Asegurarse de resetear la bandera  
    }  
}  
  
/**  
 * Abre el modal de análisis detallado.  
 */  
async function analysisMode() {  
    const analysisModal = document.getElementById('analysisModal');  
    if (analysisModal) analysisModal.classList.add('active');  
  
    const analysisLoading = document.getElementById('analysisLoading');  
    if (analysisLoading) analysisLoading.style.display = 'inline-block';  
    const analysisStatus = document.getElementById('analysisStatus');  
    if (analysisStatus) analysisStatus.textContent = 'Analizando posición...';  
  
    await performAnalysis();  
}  
  
/**  
 * Cierra el modal de análisis detallado.  
 */  
function closeAnalysis() {  
    const analysisModal = document.getElementById('analysisModal');  
    if (analysisModal) analysisModal.classList.remove('active');  
}  
  
/**  
 * Realiza un análisis profundo de la posición actual y muestra los resultados en el modal.  
 */  
async function performAnalysis() {  
    if (!window.engineReady) {  
        const analysisStatus = document.getElementById('analysisStatus');  
        if (analysisStatus) analysisStatus.textContent = '⚠️ Stockfish no está disponible para análisis detallado.';  
        const analysisLoading = document.getElementById('analysisLoading');  
        if (analysisLoading) analysisLoading.style.display = 'none';  
  
        const localScore = window.evaluatePositionLocal ? window.evaluatePositionLocal(game) : 0;  
        const localProb = calculateWinProbability(localScore);  
  
        document.getElementById('currentScore').innerHTML = (localScore / 100).toFixed(2);  
        document.getElementById('whiteWinProb').innerHTML = localProb.white + '%';  
        document.getElementById('drawProb').innerHTML = localProb.draw + '%';  
        document.getElementById('blackWinProb').innerHTML = localProb.black + '%';  
        document.getElementById('anyWinProb').innerHTML = localProb.decisive + '%';  
        document.getElementById('bestMoveAnalysis').innerHTML = '-';  
        document.getElementById('analysisDepth').innerHTML = 'N/A';  
        document.getElementById('principalVariation').innerHTML = 'N/A (Stockfish no disponible)';  
        document.getElementById('openingEval').innerHTML = '-';  
        document.getElementById('middlegameEval').innerHTML = '-';  
        document.getElementById('endgameEval').innerHTML = '-';  
        document.getElementById('materialEval').innerHTML = (localScore / 100).toFixed(2);  
        return;  
    }  
  
    const analysisStatus = document.getElementById('analysisStatus');  
    if (analysisStatus) analysisStatus.textContent = 'Analizando posición...';  
    const analysisLoading = document.getElementById('analysisLoading');  
    if (analysisLoading) analysisLoading.style.display = 'inline-block';  
  
    const analysisDepth = 24;  
    const analysisTimeout = 15000;  
    const result = await window.evaluateWithStockfish(analysisDepth, analysisTimeout); // Esto usará el worker  
  
    const score = result.score;  
    const prob = calculateWinProbability(score);  
    const bestMoveUci = result.bestMove;  
    let bestMoveSan = '-';  
  
    if (bestMoveUci) {  
        const tempGameForSan = new Chess(game.fen());  
        const from = bestMoveUci.substring(0, 2);  
        const to = bestMoveUci.substring(2, 4);  
        const promotion = bestMoveUci.length > 4 ? bestMoveUci[4].toLowerCase() : undefined;  
        try {  
            const tempMove = tempGameForSan.move({ from, to, promotion });  
            if (tempMove) {  
                bestMoveSan = tempMove.san;  
            } else {  
                console.warn("No se pudo convertir el bestMove UCI a SAN:", bestMoveUci);  
                bestMoveSan = bestMoveUci;  
            }  
        } catch (error) {  
             console.warn("Error al convertir bestMove UCI a SAN:", error);  
             bestMoveSan = bestMoveUci;  
        }  
    }  
  
    document.getElementById('whiteWinProb').innerHTML = prob.white + '%';  
    document.getElementById('drawProb').innerHTML = prob.draw + '%';  
    document.getElementById('blackWinProb').innerHTML = prob.black + '%';  
    document.getElementById('anyWinProb').innerHTML = prob.decisive + '%';  
    document.getElementById('currentScore').innerHTML = (score / 100).toFixed(2);  
    document.getElementById('bestMoveAnalysis').innerHTML = bestMoveSan;  
    document.getElementById('analysisDepth').innerHTML = result.depth + ' movimientos';  
  
    const principalVariationEl = document.getElementById('principalVariation');  
    if (principalVariationEl) {  
        if (result.pv && result.pv.length > 0) {  
            const pvSan = convertPvUciToSan(result.pv, game.fen());  
            principalVariationEl.innerHTML = pvSan;  
        } else {  
            principalVariationEl.innerHTML = 'No se encontró variante principal.';  
        }  
    } else {  
        console.warn("Elemento 'principalVariation' no encontrado.");  
    }  
  
    const board = game.board();  
    let material = 0;  
    const pieceValuesMaterial = { 'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900 };  
    for (let row of board) {  
        for (let p of row) {  
            if (!p) continue;  
            const val = pieceValuesMaterial[p.type] || 0;  
            material += p.color === 'w' ? val : -val;  
        }  
    }  
    const history = game.history({ verbose: true });  
    const phase = history.length < 10 ? 'Apertura' : history.length < 40 ? 'Medio Juego' : 'Final';  
  
    document.getElementById('materialEval').innerHTML = (material / 100).toFixed(2);  
    document.getElementById('openingEval').innerHTML = phase === 'Apertura' ? (score / 100).toFixed(2) : '-';  
    document.getElementById('middlegameEval').innerHTML = phase === 'Medio Juego' ? (score / 100).toFixed(2) : '-';  
    document.getElementById('endgameEval').innerHTML = phase === 'Final' ? (score / 100).toFixed(2) : '-';  
  
    if (analysisStatus) analysisStatus.textContent = '✅ Análisis completado';  
    if (analysisLoading) analysisLoading.style.display = 'none';  
}  
  
  
// ===================== CONVERTIDOR UCI A SAN PARA PV =====================  
  
/**  
 * Convierte una secuencia de movimientos en notación UCI a SAN.  
 */  
function convertPvUciToSan(pvUciArray, initialFen) {  
    const tempGame = new Chess(initialFen);  
    const pvSanArray = [];  
  
    for (const uciMove of pvUciArray) {  
        const from = uciMove.substring(0, 2);  
        const to = uciMove.substring(2, 4);  
        const promotion = uciMove.length > 4 ? uciMove[4].toLowerCase() : undefined;  
  
        try {  
            const move = tempGame.move({ from, to, promotion });  
            if (move) {  
                pvSanArray.push(move.san);  
            } else {  
                console.warn(`Movimiento UCI inválido en PV: '${uciMove}' en FEN: '${tempGame.fen()}'`);  
                pvSanArray.push(uciMove);  
                break;  
            }  
        } catch (error) {  
            console.error(`Error al procesar movimiento UCI '${uciMove}' en FEN '${tempGame.fen()}':`, error);  
            pvSanArray.push(uciMove);  
            break;  
        }  
    }  
    return pvSanArray.join(' ');  
}  
  
  
// ===================== EXPORTAR GLOBALES =====================  
window.game = game;  
window.updateEvalBar = updateEvalBar;  
window.renderBoard = renderBoard;  
window.updateUI = updateUI;  
window.resetGame = resetGame;  
window.undoMove = undoMove;  
window.flipBoard = flipBoard;  
window.requestHint = requestHint;  
window.analysisMode = analysisMode;  
window.closeAnalysis = closeAnalysis;  
window.convertPvUciToSan = convertPvUciToSan;  
// Exportar evaluatePositionLocal para que game.js pueda usarla como fallback si es necesario  
// Esta variable se define en stockfish-ai.js y se hace global allí.  
// Aquí solo nos aseguramos de que esté presente o sea null si no lo está.  
window.evaluatePositionLocal = window.evaluatePositionLocal || null;  
