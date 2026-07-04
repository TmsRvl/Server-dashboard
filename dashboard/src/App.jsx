import { useState, useEffect } from 'react';
import { SimpleTable } from '@simple-table/react';
import '@simple-table/react/styles.css';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const INTERVALLO_AGGIORNAMENTO = 5000;
const OGGI = new Date().toISOString().split('T')[0];
const PERIODO = 8;

function App() {
  // Stato per la navigazione: 'tabella' | 'tempo' | 'errori'
  const [paginaAttiva, setPaginaAttiva] = useState('tabella');

  const [query, setQuery] = useState('');
  const [datiTraffico, setDatiTraffico] = useState([
    { metodo: 'Caricamento...', uri: 'Attendi...', code: 0, ip: "0.0.0.0", tempo: 0 }
  ]);
  const [atr, setAtr] = useState('...');
  const [er, setEr] = useState('0');

  const [tempoRispostaMedio, setTempoRispostaMedio] = useState([
    { tempo: "..." , trm: "0.00" }
  ]);
  const [tassoErroreMedio, setTassoErroreMedio] = useState([
    { tempo: "..." , tem: "0.00" }
  ]);

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
    { label: 'Code', accessor: 'code', minWidth: 150, width: "1.2fr", type: "number", filterable: true, filterType: 'number', align: "left", 
    cellRenderer: ({ row }) => {
    const codice = Number(row.code);
    const colore = (codice >= 200 && codice <= 299) ? '#0f532a' : '#720507';
    const bgcolor = (codice >= 200 && codice <= 299) ? '#2ed573' : '#f18284';
    return (
      <span style={{ color: bgcolor, borderRadius: '5px', paddingInline: '4px', backgroundColor: colore, fontWeight: 'bold' }}>
        {codice}
      </span>
    );
    }},
    { label: 'IP', accessor: 'ip', minWidth: 150, width: "1.2fr", type: "string", filterable: false, align: "left" },
    { label: 'Tempo (ms)', accessor: 'tempo', minWidth: 150, width: "1.2fr", type: "number", filterable: true, align: "left" }
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

    
    fetch(`http://192.168.1.100:5554/trm.php` + (query !== '' ? '?' + query : ''))
      .then(res => res.json())
      .then(d => setTempoRispostaMedio(d.data))
      .catch(err => console.error("Errore Traffico:", err));
    fetch(`http://192.168.1.100:5554/tem.php` + (query !== '' ? '?' + query : ''))
      .then(res => res.json())
      .then(d => setTassoErroreMedio(d.data))
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
    if (filtroDataFine && (valore > filtroDataFine || filtroDataFine > nuovoMax)) {
      setFiltroDataFine('');
      setFiltroOraInizio('');
      setFiltroOraFine('');
    }
  };

  const handleOraInizioChange = (valore) => {
    setFiltroOraInizio(valore);
    if (filtroOraFine && valore > filtroOraFine) {
      setFiltroOraFine('');
    }
  };

  const handleOraFineChange = (valore) => {
    if (filtroOraInizio && valore <= filtroOraInizio) {
      const aggiungiUnMinuto = (orarioStringa) => {
        if (!orarioStringa) return '';
        const [ore, minuti] = orarioStringa.split(':').map(Number);
        let nuoviMinuti = minuti + 15;
        let nuoveOre = ore;
        if (nuoviMinuti >= 60) {
          nuoviMinuti = 0;
          nuoveOre = (ore + 1) % 24;
        }
        return `${nuoveOre.toString().padStart(2, '0')}:${nuoviMinuti.toString().padStart(2, '0')}`;
      };
      setFiltroOraFine(aggiungiUnMinuto(filtroOraInizio));
    } else {
      setFiltroOraFine(valore);
    }
  };

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
    setQuery(buff);
  };

  // Funzione inline per gestire lo stile dei pulsanti del menu
  const stileBottoneMenu = (attivo) => ({
    width: '100%',
    padding: '12px 15px',
    textAlign: 'left',
    backgroundColor: attivo ? '#007bff' : 'transparent',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: attivo ? 'bold' : 'normal',
    fontSize: '14px',
    transition: 'background-color 0.5s',
    marginBottom: '8px'
  });

  return (
    <div style={{
      display: 'flex',
      width: '100%',        
      minHeight: '100vh',
      backgroundColor: '#121620',
      color: '#fff',
      fontFamily: 'sans-serif',
      margin: 0,
      padding: 0
    }}>

      {/* MENU LATERALE */}
      <aside style={{ width: '10%', backgroundColor: '#1a1f2c', padding: '20px', borderRight: '1px solid #2d3748' }}>
        <h3 style={{ color: 'gainsboro', marginTop: '15px', marginBottom: '40px', paddingBottom: '10px', fontSize: '16px', letterSpacing: '5px', borderBottom: '1px solid white'}}>ATTIVITÀ</h3>
        <button style={stileBottoneMenu(paginaAttiva === 'tabella')} onClick={() => setPaginaAttiva('tabella')}>
         Tabella Traffico
        </button>
        <button style={stileBottoneMenu(paginaAttiva === 'tempo')} onClick={() => setPaginaAttiva('tempo')}>
         Tempo Risposta
        </button>
        <button style={stileBottoneMenu(paginaAttiva === 'errori')} onClick={() => setPaginaAttiva('errori')}>
          Tasso Errore
        </button>
      </aside>

      {/* CONTENUTO PRINCIPALE */}
      <main style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>

        {/* HEADER STATISTICHE SEMPRE VISIBILE */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2 style={{ margin: 0 }}>Monitoraggio Traffico di Rete</h2>
          <div style={{ display: 'flex', gap: '40px', fontSize: '15px' }}>
            <span>Tempo medio risposta: <b style={{ color: (paginaAttiva === 'tempo') ? '#9292e2' : 'gainsboro', backgroundColor: (paginaAttiva === 'tempo') ? '#0505af' : 'transparent', padding: '3px', borderRadius: '6px', fontSize: '16px' }}>{atr}</b> ms</span>
            <span>Tasso di errore: <b style={{ color: (paginaAttiva === 'errori') ? '#cc9192' : 'gainsboro', backgroundColor: (paginaAttiva === 'errori') ? '#720507' : 'transparent', padding: '3px', borderRadius: '6px', fontSize: '16px' }}>{er}%</b> </span>
          </div>
        </div>

        {/* PAGINA 1: TABELLA E FILTRI */}
        {paginaAttiva === 'tabella' && (
          <>
            <fieldset style={{ border: '1px solid #2d3748', borderRadius: '5px', padding: '15px', marginBottom: '20px', backgroundColor: '#1a1f2c' }}>
              <legend style={{ fontWeight: 'bold', padding: '0 10px', color: '#ccc' }}>Filtri Avanzati</legend>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>Da Data:</label>
                  <input type="date" value={filtroDataInizio} max={OGGI} onChange={e => handleDataInizioChange(e.target.value)} style={{ background: '#121620', color: '#fff', border: '1px solid #2d3748', padding: '4px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>A Data:</label>
                  <input type="date" value={filtroDataFine} min={filtroDataInizio} max={maxDataFine} disabled={!filtroDataInizio} onChange={e => setFiltroDataFine(e.target.value)} style={{ background: '#121620', color: '#fff', border: '1px solid #2d3748', padding: '4px' }} />
                </div>
                {filtroDataInizio && filtroDataInizio === filtroDataFine && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>Da Ora:</label>
                      <input type="time" value={filtroOraInizio} onChange={e => handleOraInizioChange(e.target.value)} style={{ background: '#121620', color: '#fff', border: '1px solid #2d3748', padding: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>A Ora:</label>
                      <input type="time" value={filtroOraFine} min={filtroOraInizio} disabled={!filtroOraInizio} onChange={e => handleOraFineChange(e.target.value)} style={{ background: '#121620', color: '#fff', border: '1px solid #2d3748', padding: '4px' }} />
                    </div>
                  </>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>Metodo:</label>
                  <select value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)} style={{ background: '#121620', color: '#fff', border: '1px solid #2d3748', padding: '5px' }}>
                    <option value="ALL">Tutti</option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div style={{ flexGrow: 1 }} />
                <button onClick={resetFiltri} style={{ padding: '4px 12px', cursor: 'pointer', background: '#333', color: '#fff', border: 'none', borderRadius: '3px' }}>Cancella</button>
                <button onClick={cerca} style={{ padding: '4px 15px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '3px', fontWeight: 'bold' }}>Cerca</button>
              </div>
            </fieldset>

            <SimpleTable defaultHeaders={colonne} rows={datiTraffico} theme='modern-dark' columnBorders={true} />
          </>
        )}

        {/* PAGINA 2: GRAFICO TEMPO DI RISPOSTA */}
        {paginaAttiva === 'tempo' && (
          <div style={{ backgroundColor: '#1a1f2c', padding: '20px', borderRadius: '6px', border: '1px solid #2d3748' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Andamento dei Tempi di Risposta</h3>
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <LineChart data={tempoRispostaMedio} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                  <XAxis dataKey="tempo" stroke="#cbd5e1" tick={{ fontSize: 11 }} />
                  <YAxis unit="ms" stroke="#cbd5e1" tick={{ fontSize: 11 }}/>
                  <Tooltip contentStyle={{ backgroundColor: '#1a1f2c', borderColor: '#2d3748', color: '#fff' }} />
                  <Legend />
                  <Line type="monotone" dataKey="trm" name="Tempo di Risposta (ms)" stroke="#007bff" strokeWidth={2} activeDot={{ r: 6 }} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* PAGINA 3: GRAFICO TASSO ERRORE */}
        {paginaAttiva === 'errori' && (
          <div style={{ backgroundColor: '#1a1f2c', padding: '20px', borderRadius: '6px', border: '1px solid #2d3748' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Distribuzione Tasso Errore Medio </h3>
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <LineChart data={tassoErroreMedio} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                  <XAxis dataKey="tempo" stroke="#cbd5e1" tick={{ fontSize: 11 }} />
                  <YAxis unit="%" stroke="#cbd5e1" domain={[0, 100]} tick={{ fontSize: 13 }}/>
                  <Tooltip contentStyle={{ backgroundColor: '#1a1f2c', borderColor: '#2d3748', color: '#fff' }} />
                  <Legend />
                  <Line type="step" dataKey="tem" name="Errore medio per periodo" stroke="#ff4d4f" strokeWidth={2} dot={true} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;