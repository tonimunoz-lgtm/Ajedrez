let engine = null;
let engineReady = false;
let pendingResolve = null;

function initStockfish() {
  console.log('Cargando Stockfish desde js/stockfish.js (local)');
  engine = new Worker('js/stockfish.js');

  engine.onmessage = (event) => {
    const msg = event.data || event;
    if (!msg) return;

    if (msg === 'uciok') engine.postMessage('isready');

    if (msg === 'readyok') {
      engineReady = true;
      console.log('✅ Stockfish listo');
      document.getElementById('coachMessage').innerHTML = '<strong>✅ Stockfish listo</strong>';
    }

    if (pendingResolve && msg.startsWith('bestmove')) {
      const match = msg.match(/bestmove (\S+)/);
      if (match) {
        pendingResolve(match[1]);
        pendingResolve = null;
      }
    }
  };

  engine.postMessage('uci');
  engine.postMessage('setoption name Threads value 4');
  engine.postMessage('setoption name Hash value 128');

  setTimeout(() => {
    if (!engineReady) {
      fallbackMode();
    }
  }, 5000);
}

function fallbackMode() {
  engineReady = false;
  console.warn('⚠️ Stockfish no disponible, usando evaluación local');
  document.getElementById('coachMessage').innerHTML =
    '<strong>⚠️ Análisis Local</strong> Stockfish no disponible';
}

function evaluateWithStockfish(depth = 10) {
  return new Promise((resolve) => {
    if (!engineReady || !engine) return resolve(null);
    pendingResolve = resolve;
    engine.postMessage('position fen ' + game.fen());
    engine.postMessage('go depth ' + depth);
  });
}

async function getBestMoveStockfish(depth = 10) {
  const bestMoveStr = await evaluateWithStockfish(depth);
  if (!bestMoveStr) return null;

  const from = bestMoveStr.substring(0, 2);
  const to = bestMoveStr.substring(2, 4);
  const promotion = bestMoveStr.length > 4 ? bestMoveStr[4] : undefined;

  try {
    const moveObj = game.move({ from, to, promotion });
    if (moveObj) {
      game.undo(); // solo predecimos
      return moveObj;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}
