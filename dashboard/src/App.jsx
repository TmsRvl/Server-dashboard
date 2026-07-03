import { useState, useEffect } from 'react';
import { SimpleTable } from '@simple-table/react';
import '@simple-table/react/styles.css';

const INTERVALLO_AGGIORNAMENTO = 5000;

const OGGI = new Date().toISOString().split('T')[0];

const PERIODO = 8; //indica il massimo periodo selezionabile in termini di giorni nel campo data inizio/fine nella parte dei filtri

function App() {
  const [query, setQuery] = useState('');

  // Allineati i tipi del mockup (code e tempo come numeri reali)
  const [datiTraffico, setDatiTraffico] = useState([
    { metodo: 'Caricamento...', uri: 'Attendi...', code: 0, ip: "0.0.0.0", tempo: 0 }
  ]);

  const [atr, setAtr] = useState('...');

  const [er, setEr] = useState('0');

  const [filtroDataInizio, setFiltroDataInizio] = useState('');
  const [filtroDataFine, setFiltroDataFine] = useState('');
  const [filtroOraInizio, setFiltroOraInizio] = useState('');
  const [filtroOraFine, setFiltroOraFine] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('ALL');
  const [maxDataFine, setMaxDataFine] = useState(OGGI);

  const colonne = [
    { label: 'Data', accessor: 'data', minWidth: 150, width: "1.2fr", type: "date", filterable: true, align: "left" },
    { label: 'Ora', accessor: 'ora', minWidth: 150, width: "1.2fr", filterable: false, align: "left" },
    { label: 'Metodo', accessor: 'metodo', minWidth: 150, width: "1.2fr", type: "string", filterable: true, align: "left" },
    { label: 'URI', accessor: 'uri', minWidth: 150, width: "1.2fr", type: "string", filterable: false, align: "left" },
    { label: 'Code', accessor: 'code', minWidth: 150, width: "1.2fr", type: "number", filterable: true, filterType: 'number', align: "left" },
    { label: 'IP', accessor: 'ip', minWidth: 150, width: "1.2fr", type: "string", filterable: false, align: "left" },
    { label: 'Tempo (ms)', accessor: 'tempo', minWidth: 150, width: "1.2fr", type: "number", filterable: true, align: "left" }
    //qui ci metterei il bottone per i dettagli
  ];

  const caricaTuttiIDati = () => {
    fetch(`http://192.168.1.100:5554/atr.php` + (query !== '' ? '?' + query : ''))
      .then(res => res.json())
      .then(d => setAtr(Number(d.data[0].atr).toFixed(3)))
      .catch(err => console.error("Errore ATR:", err));

    fetch(`http://192.168.1.100:5554/er.php` + (query !== '' ? '?' + query : ''))
      .then(res => res.json())
      .then(d => setEr(Number(d.data[0].er).toFixed(2)))
      .catch(err => console.error("Errore Er:", err));

    fetch(`http://192.168.1.100:5554/api.php` + (query !== '' ? '?' + query : ''))
      .then(res => res.json())
      .then(d => setDatiTraffico(d.data))
      .catch(err => console.error("Errore Traffico:", err));
  };

  useEffect(() => {
    caricaTuttiIDati(); 
    const intervalId = setInterval(() => {
      caricaTuttiIDati(); 
    }, INTERVALLO_AGGIORNAMENTO);

    return () => clearInterval(intervalId);
  }, [query]); 

  const handleDataInizioChange = (valore) => {
    setFiltroDataInizio(valore);

    const nuovoMax = calcolaMaxDataFine(valore);
    setMaxDataFine(nuovoMax);

    // Se la data fine corrente è precedente alla nuova data inizio, la resetta o la pareggia
    if (filtroDataFine && (valore > filtroDataFine || filtroDataFine > nuovoMax)) {
      setFiltroDataFine('');
      setFiltroOraInizio('');
      setFiltroOraFine('');
    }
  };

  const handleOraInizioChange = (valore) => {
    setFiltroOraInizio(valore);
    // Se l'ora di fine inserita in precedenza è minore della nuova ora di inizio, resetta l'ora di fine
    if (filtroOraFine && valore > filtroOraFine) {
      setFiltroOraFine('');
    }
  };

  const handleOraFineChange = (valore) => {
    // BLOCCO DIGITAZIONE TASTIERA: Se l'utente scrive a mano un'ora precedente a quella iniziale,
    // forziamo lo stato a matchare l'ora iniziale (o puoi impostarlo a stringa vuota '')
    if (filtroOraInizio && valore <= filtroOraInizio) {
      const aggiungiUnMinuto = (orarioStringa) => {
        if (!orarioStringa) return '';
        const [ore, minuti] = orarioStringa.split(':').map(Number);

        let nuoviMinuti = minuti + 1;
        let nuoveOre = ore;

        if (nuoviMinuti >= 60) {
          nuoviMinuti = 0;
          nuoveOre = (ore + 1) % 24; // Se sono le 23:59 diventa 00:00
        }

        // Trasforma di nuovo in formato a due cifre (es. "09:05")
        const hh = nuoveOre.toString().padStart(2, '0');
        const mm = nuoviMinuti.toString().padStart(2, '0');

        return `${hh}:${mm}`;
      };
      setFiltroOraFine(aggiungiUnMinuto(filtroOraInizio));
    } else {
      setFiltroOraFine(valore);
    }
  };

  // Calcola la data massima consentita (5 giorni dopo la data inizio) senza superare oggi
  const calcolaMaxDataFine = (dataInizio) => {
    if (!dataInizio) return OGGI;

    const data = new Date(dataInizio);
    data.setDate(data.getDate() + (PERIODO - 1));

    const dataFormattata = data.toISOString().split('T')[0];

    return dataFormattata < OGGI ? dataFormattata : OGGI;
  };

  const resetFiltri = () => {
    setFiltroDataInizio('');
    setFiltroDataFine('');
    setFiltroOraInizio('');
    setFiltroOraFine('');
    setFiltroMetodo('ALL');
  };

  const cerca = () => {
    if ((filtroDataInizio && !filtroDataFine) || (!filtroDataInizio && filtroDataFine)) {
      resetFiltri();
      alert("Devi impostare sia la data d'inizio che quella di fine!");
      return;
    }
    if ((filtroDataInizio === filtroDataFine) && (filtroOraInizio && !filtroOraFine)) {
      resetFiltri();
      alert("Devi impostare anche l'ora di fine!");
      return;
    }
    if (!filtroDataInizio && !filtroDataFine && filtroMetodo === 'ALL') {
      setQuery('');
      caricaTuttiIDati('');
      return;
    }
    //qui posso costruire finalmente la query
    var buff = '';
    if (filtroDataInizio) {
      if (filtroDataInizio === filtroDataFine) {
        if (filtroOraInizio) {
          buff += 'dataini=' + filtroDataInizio + '&datafin=' + filtroDataFine + '&oraini=' + filtroOraInizio + '&orafin=' + filtroOraFine;
        } else {
          buff += 'dataini=' + filtroDataInizio + '&datafin=' + filtroDataFine;
        }
      } else {
        buff += 'dataini=' + filtroDataInizio + '&datafin=' + filtroDataFine;
      }
    }

    if (filtroMetodo !== 'ALL') { buff += (filtroDataInizio ? '&' : '') + 'metodo=' + filtroMetodo; }

    console.log(buff);
    setQuery(buff);
  };


  return (
    <div style={{ padding: '30px' }}>
      <h2>Monitoraggio Traffico di Rete</h2>
      <br />
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <span>Tempo medio risposta: <b>{atr}</b> ms</span>
        <span>Tasso di errore: <b>{er}</b> %</span>
      </div>
      <br /><br />

      <fieldset style={{ border: '1px solid #ccc', borderRadius: '5px', padding: '15px', marginBottom: '20px' }}>
        <legend style={{ fontWeight: 'bold', padding: '0 10px' }}>Filtri Avanzati</legend>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>

          <div>
            <label style={{ display: 'block', fontSize: '12px' }}>Da Data:</label>
            <input
              type="date"
              value={filtroDataInizio}
              max={OGGI}
              onChange={e => handleDataInizioChange(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px' }}>A Data:</label>
            <input
              type="date"
              value={filtroDataFine}
              min={filtroDataInizio} // <--- Impedisce la selezione di date precedenti
              max={maxDataFine}
              disabled={!filtroDataInizio} // Disabilitato finché non selezioni la data di inizio
              onChange={e => setFiltroDataFine(e.target.value)}
            />
          </div>

          {/* I filtri Ora compaiono solo se siamo nello stesso giorno */}
          {filtroDataInizio && filtroDataInizio === filtroDataFine && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '12px' }}>Da Ora:</label>
                <input
                  type="time"
                  value={filtroOraInizio}
                  onChange={e => handleOraInizioChange(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px' }}>A Ora:</label>
                <input
                  type="time"
                  value={filtroOraFine}
                  min={filtroOraInizio} // <--- Impedisce la selezione di orari precedenti
                  disabled={!filtroOraInizio} // Disabilitato finché non selezioni l'ora di inizio
                  onChange={e => handleOraFineChange(e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px' }}>Metodo:</label>
            <select value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)}>
              <option value="ALL">Tutti</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div style={{ flexGrow: 1 }} />

          <button onClick={resetFiltri} style={{ padding: '3px 10px', width: '80px', height: '24px', cursor: 'pointer' }}>Cancella</button>
          <button
            onClick={() => {
              cerca();
              console.log('Filtri applicati:', { filtroDataInizio, filtroDataFine, filtroOraInizio, filtroOraFine, filtroMetodo });
            }}
            style={{
              padding: '3px 10px',
              cursor: 'pointer',
              backgroundColor: '#007bff',
              width: '70px',
              height: '24px',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              fontWeight: 'bold',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
          >
            Cerca
          </button>
        </div>
      </fieldset>

      <SimpleTable
        defaultHeaders={colonne}
        rows={datiTraffico}
        theme='modern-dark'
        columnBorders={true}
      />
    </div>
  );
}

export default App;
