import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

const logDirectory = './log';

const dbConfig = {
  host: 'localhost',
  user: 'log_user',
  password: 'password',
  database: 'http_logs'
};

const fileQueue = [];
let isProcessing = false;

function enqueueFile(filename) {
  // Evitiamo di aggiungere duplicati se l'evento scatta più volte per lo stesso file
  if (!fileQueue.includes(filename)) {
    fileQueue.push(filename);
    processQueue();
  }
}

async function processQueue() {
  if (isProcessing || fileQueue.length === 0) return;

  isProcessing = true;
  const nextFile = fileQueue.shift(); // Prende il primo file della coda

  try {
    await processSingleFile(nextFile);
  } catch (err) {
    console.error('Errore critico nella coda per il file ' + nextFile + ':', err.message);
  }

  isProcessing = false;
  //passa al prossimo file nella coda
  processQueue();
}

async function saveOnDb(connectionData) {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    const req = connectionData.request;
    const res = connectionData.response;

    const queryConnection = 'INSERT INTO connection (req_version, req_uri, req_method, res_version, res_code, res_phrase, res_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))';
    const valConnection = [
      req['version'], req['uri'], req['method'],
      res['version'], res['status-code'], res['phrase'], res['time-response'], req['time']
    ];

    const resConn = await connection.execute(queryConnection, valConnection);
    const connectionId = resConn[0].insertId;

    if (req.headers) await insertHeaders(connection, connectionId, req.headers, 'request');
    if (res.headers) await insertHeaders(connection, connectionId, res.headers, 'response');

    await connection.commit();
  } catch (error) {
    if (connection) 
      await connection.rollback();
    console.error('Error DB:', error.message);
    throw error;
  } finally {
    if (connection) 
      await connection.end();
  }
}

async function insertHeaders(connection, connectionId, headers, type) {
  for (const [key, val] of Object.entries(headers)) {
    const stringVal = String(val);
    const queryHeader = 'INSERT INTO header (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)';
    const resHeader = await connection.execute(queryHeader, [key, stringVal]);
    const headerId = resHeader[0].insertId;

    const queryPivot = 'INSERT INTO connection_header (connection_id, header_id, type) VALUES (?, ?, ?)';
    await connection.execute(queryPivot, [connectionId, headerId, type]);
  }
}

async function processSingleFile(file) {
  const completePath = path.join(logDirectory, file);

  try {
    await fsp.access(completePath);
    const data = await fsp.readFile(completePath, 'utf8');
    
    if (!data.trim()) {
      //se il file è vuoto, rimettilo in coda per riprovare al prossimo giro
      fileQueue.push(file);
      return;
    }

    const jsonLog = JSON.parse(data);

    if (jsonLog && jsonLog.connection) {
      await saveOnDb(jsonLog.connection);
      await fsp.unlink(completePath);
      console.log(`File ${file} elaborato correttamente.`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') return; // File già rimosso, ignora
    
    if (error instanceof SyntaxError) {
      // JSON malformato (magari non ha finito di scrivere), riprova più tardi
      fileQueue.push(file);
    } else {
      console.error('Errore imprevisto sul file ' + file + ':', error.message);
    }
  }
}

async function startWatching() {
  try {
    const files = await fsp.readdir(logDirectory);

    for (const filename of files) {
      // Filtra per assicurarti che siano file (opzionale, ma consigliato)
      const fullPath = path.join(logDirectory, filename);
      const stat = await fsp.stat(fullPath);

      if (stat.isFile()) {
        // console.log(`Trovato file preesistente: ${filename}`);
        enqueueFile(filename);
      }
    }
  } catch (err) {
    console.error("Errore durante la lettura iniziale della cartella:", err.message);
  }

  // console.log(`Monitoraggio sicuro avviato su: ${logDirectory}`);
  fs.watch(logDirectory, (eventType, filename) => {
    if (filename && (eventType === 'change' || eventType === 'rename')) { // dovrebbe bastare solo rename
      setTimeout(() => {
        enqueueFile(filename);
      }, 50);  //piccolo timeout per evitare di leggere il file prima che sia completamente scritto
    }
  });
}

startWatching();
