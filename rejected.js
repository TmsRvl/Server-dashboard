const { Tail } = require('tail');
const mysql = require('mysql2/promise');

// 1. Configurazione Database
const dbConfig = {
    host: 'localhost',
    user: 'log_user',
    password: 'password',
    database: 'http_logs',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
};

const LOG_FILE_PATH = '/var/log/apache2/error.log';

// Formattazione data locale ("YYYY-MM-DD HH:mm:ss") senza sfasamento UTC
function formatToSqlDateTime(dateObj) {
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    const mm = pad(dateObj.getMonth() + 1);
    const dd = pad(dateObj.getDate());
    const hh = pad(dateObj.getHours());
    const mi = pad(dateObj.getMinutes());
    const ss = pad(dateObj.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function parseApacheDate(dateStr) {
    // Rimuove i microsecondi che potrebbero confondere il parser Date nativo
    // es: "Fri Aug 21 10:11:55.953709 2026" -> "Fri Aug 21 10:11:55 2026"
    const cleaned = dateStr.replace(/\.\d{6}/, '');
    const d = new Date(cleaned);

    if (isNaN(d.getTime())) {
        return formatToSqlDateTime(new Date());
    }
    return formatToSqlDateTime(d);
}

async function startWatcher() {
    let pool;
    let tail;

    try {
        pool = mysql.createPool(dbConfig);
        console.log('Connessione al database MySQL inizializzata.');

        const tailOptions = {
            separator: /[\r]{0,1}\n/,
            fromBeginning: false,
            follow: true,
            useWatchFile: true // Garantisce il riaggancio in caso di rotazione log
        };

        tail = new Tail(LOG_FILE_PATH, tailOptions);
        console.log(`In ascolto continuo su ${LOG_FILE_PATH}...`);

        tail.on('line', async (line) => {
            if (line.includes('proxy_http:error')) {
                const timestampMatch = line.match(/^\[(.*?)\]/);
                const formattedTime = timestampMatch 
                    ? parseApacheDate(timestampMatch[1]) 
                    : formatToSqlDateTime(new Date());

                const errorName = 'proxy_http:error';

                try {
                    const query = 'INSERT INTO error_logs (time_error, name) VALUES (?, ?)';
                    await pool.execute(query, [formattedTime, errorName]);
                    console.log(`[${formattedTime}] Registrato errore -> ${errorName}`);
                } catch (dbErr) {
                    console.error('Errore INSERT DB:', dbErr.message);
                }
            }
        });

        tail.on('error', (err) => {
            console.error('Errore tail:', err.message);
        });

    } catch (err) {
        console.error('Errore di avvio watcher:', err.message);
        process.exit(1);
    }

    // Gestione terminazione ordinata del servizio
    const shutdown = async () => {
        console.log('\nChiusura servizio in corso...');
        if (tail) tail.unwatch();
        if (pool) await pool.end();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

startWatcher();
