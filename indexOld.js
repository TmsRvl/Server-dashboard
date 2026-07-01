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

async function saveOnDb(connList) {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);
    
    await connection.beginTransaction();

    for (const elem of connList) {
      const connData = elem.connection;
      const req = connData.request;
      const res = connData.response;

      const queryConnection = 'INSERT INTO connection (req_version, req_uri, req_method, res_version, res_code, res_phrase, res_time) VALUES (?, ?, ?, ?, ?, ?, ?)';
      const valConnection = [
        req['version'],
        req['uri'], 
        req['method'], 
        res['version'],
        res['status-code'],
        res['phrase'],
        res['time-ms']
      ];

      const resConn = await connection.execute(queryConnection, valConnection);
      const connectionId = resConn[0].insertId;

      if (req.headers) {
        await insertHeaders(connection, connectionId, req.headers, 'request');
      }
      if (res.headers) {
        await insertHeaders(connection, connectionId, res.headers, 'response');
      }
    }
    await connection.commit();

  } catch (error) {
    if (connection) await connection.rollback();
    
    console.error('Error:', error.message);
    throw error;

  } finally {
    if (connection) await connection.end();
  }
}

// async function insertHeaders(connection, connectionId, headers, type) {
//   for (const [key, val] of Object.entries(headers)) {
//     const queryHeader = 'INSERT INTO header (name, value) VALUES (?, ?)';
//     const resHeader = await connection.execute(queryHeader, [key, String(val)]);
//     const headerId = resHeader[0].insertId; 

//     const queryPivot = 'INSERT INTO connection_header (connection_id, header_id, type) VALUES (?, ?, ?)';
//     await connection.execute(queryPivot, [connectionId, headerId, type]);
//   }
// }

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

//ritorna l'orario attuale hh-mm
function getCurrentTime() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return hh + '-' + mm;
}

async function transferLogs() {
  try {
    const files = await fsp.readdir(logDirectory);
    const currentTime = getCurrentTime();

    for (const file of files) {
      if(path.parse(file).name != currentTime){  // se si tratta di un file vecchio
        const completePath = path.join(logDirectory, file);

        try {
            const data = await fsp.readFile(completePath, 'utf8');
            const jsonLog = JSON.parse(data);
            
            //butto tutto nel db
            await saveOnDb(jsonLog);

            //ora che i dati sono nel db, cancelliamo il file
            await fsp.unlink(completePath);
        } catch (error) {
            console.error('error on reading ' + file +':', error.message);
        }
      }
      
    }
  } catch (error) {
    console.error('error to open folder:', error.message);
  }
}

// Controlla e sfoltisce la cartella ogni 1 secondo
setInterval(transferLogs, 5000);
