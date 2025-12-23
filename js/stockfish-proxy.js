// js/stockfish-proxy.js  
// Este es un script Web Worker que actúa como intermediario para cargar Stockfish desde una CDN.  
// Esto evita problemas de CORS cuando el Worker es iniciado por el hilo principal de la página.  
  
// Importa el script de Stockfish real desde la CDN.  
// unpkg.com suele ser fiable para esto dentro de un Worker.  
importScripts('https://unpkg.com/stockfish.js/src/stockfish.js');  
  
// Opcionalmente, puedes añadir logs aquí para confirmar que este proxy se carga.  
// console.log('Stockfish proxy loaded and importing from CDN.');  
  
// El resto de la lógica de Stockfish.js (la configuración del Worker, etc.)  
// se ejecutará automáticamente después de importScripts().  
