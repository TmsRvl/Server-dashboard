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
const PERIODO = 20;

function App() {
  const [paginaAttiva, setPaginaAttiva] = useState('tabella');

  const [query, setQuery] = useState('');
  const [datiTraffico, setDatiTraffico] = useState([
    { metodo: 'Caricamento...', uri: 'Attendi...', code: 0, ip: "0.0.0.0", tempo: 0 }
  ]);
  const [atr, setAtr] = useState('...');
  const [er, setEr] = useState('0');
  const [dettagliModal, setDettagliModal] = useState(null);

  const [tempoRispostaMedio, setTempoRispostaMedio] = useState([
    { tempo: "...", trm: "0.00" }
  ]);
  const [tassoErroreMedio, setTassoErroreMedio] = useState([
    { tempo: "...", tem: "0.00" }
  ]);

  const [filtroDataInizio, setFiltroDataInizio] = useState('');
  const [filtroDataFine, setFiltroDataFine] = useState('');
  const [filtroOraInizio, setFiltroOraInizio] = useState('');
  const [filtroOraFine, setFiltroOraFine] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('ALL');
  const [maxDataFine, setMaxDataFine] = useState(OGGI);


  const colonne = [
    { label: 'Data', accessor: 'data', minWidth: 110, width: "1.2fr", type: "date", filterable: true, align: "left" },
    { label: 'Ora', accessor: 'ora', minWidth: 90, width: "1.0fr", filterable: false, align: "center" },
    { label: 'Metodo', accessor: 'metodo', minWidth: 80, width: "0.8fr", type: "string", filterable: true, align: "center" },
    { label: 'URI', accessor: 'uri', minWidth: 150, width: "2.0fr", type: "string", filterable: false, align: "left" },

    {
      label: 'Code', accessor: 'code',
      minWidth: 70,
      width: "0.6fr",
      type: "number", filterable: true, filterType: 'number', align: "center",
      cellRenderer: ({ row }) => {
        const codice = Number(row.code);
        const colore = (codice >= 200 && codice <= 299) ? '#0f532a' : '#720507';
        const bgcolor = (codice >= 200 && codice <= 299) ? '#2ed573' : '#f18284';
        return (
          <span style={{ color: bgcolor, borderRadius: '5px', paddingInline: '4px', backgroundColor: colore, fontWeight: 'bold' }}>
            {codice}
          </span>
        );
      }
    },
    { label: 'IP', accessor: 'ip', minWidth: 120, width: "1.2fr", type: "string", filterable: false, align: "center" },
    { label: 'Tempo (ms)', accessor: 'tempo', minWidth: 100, width: "1.0fr", type: "number", filterable: true, align: "center" },
    {
      label: '', accessor: 'id', minWidth: 80, width: "0.7fr", filterable: false, align: "center",
      cellRenderer: ({ row }) => {
        return (
          <button
            onClick={() => mostraDettagli(row.id)}
            style={{
              padding: '4px 8px',
              border: 'none',
              borderRadius: '4px',
              width: '100%',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: '#fff',
              fontWeight: 'bold',
              transition: 'background-color 0.5s',
            }}
          >
            <u>Espandi</u>
          </button>
        );
      }
    }
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

  const trm = () => {
    fetch(`http://192.168.1.100:5554/trm.php` + (query !== '' ? '?' + query : ''))
      .then(res => res.json())
      .then(d => setTempoRispostaMedio(d.data))
      .catch(err => console.error("Errore TRM:", err));
  }; 

  const tem = () => {
    fetch(`http://192.168.1.100:5554/tem.php` + (query !== '' ? '?' + query : ''))
      .then(res => res.json())
      .then(d => setTassoErroreMedio(d.data))
      .catch(err => console.error("Errore TEM:", err));
  };


  const mostraDettagli = (id) => {
    fetch(`http://192.168.1.100:5554/info.php?id=${id}`)
      .then((response) => {
        if (!response.ok) throw new Error("Errore di rete o server non raggiungibile");
        return response.json();
      })
      .then((data) => {
        if (data.status === "success" && data.connection.length > 0) {
          setDettagliModal(data);
        } else {
          alert("Nessun dato trovato per questa connessione.");
        }
      })
      .catch((err) => {
        console.error("Errore INFO:", err);
        alert("Impossibile recuperare i dettagli.");
      });
  };

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

  const stiliModal = {
    overlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999, backdropFilter: 'blur(4px)'
    },
    modal: {
      backgroundColor: '#1a1f2c', borderRadius: '8px', padding: '25px',
      width: '90%', maxWidth: '1000px', maxHeight: '85vh', color: '#fff',
      overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      position: 'relative', fontFamily: 'sans-serif', border: '1px solid #2d3748'
    },
    chiudiBtn: {
      position: 'absolute', top: '12px', right: '15px', border: 'none',
      background: 'none', fontSize: '22px', cursor: 'pointer', color: '#cbd5e1'
    },
    sezioneTitolo: (colore) => ({
      color: colore, borderBottom: `2px solid ${colore}`, paddingBottom: '5px', marginTop: '20px', marginBottom: '10px'
    }),
    badgeCodice: (code) => ({
      backgroundColor: code >= 200 && code <= 299 ? '#0f532a' : '#720507',
      color: code >= 200 && code <= 299 ? '#2ed573' : '#f18284',
      padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', marginLeft: '5px'
    })
  };

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#121620',
      color: '#ffffff',
      fontFamily: 'sans-serif',
      margin: 0,
      padding: 0,
      overflowX: 'hidden'
    }}>
      <aside style={{ width: '200px', minWidth: '200px', backgroundColor: '#1a1f2c', padding: '20px', borderRight: '1px solid #2d3748', boxSizing: 'border-box' }}>
        <h3 style={{ color: 'gainsboro', marginTop: '15px', marginBottom: '40px', paddingBottom: '10px', fontSize: '16px', letterSpacing: '5px', borderBottom: '1px solid white' }}>ATTIVITÀ</h3>
        <button style={stileBottoneMenu(paginaAttiva === 'tabella')} onClick={() => setPaginaAttiva('tabella')}>
          Tabella Traffico
        </button>
        <button style={stileBottoneMenu(paginaAttiva === 'tempo')} onClick={() => {setPaginaAttiva('tempo'); trm();}}>
          Tempo Risposta
        </button>
        <button style={stileBottoneMenu(paginaAttiva === 'errori')} onClick={() => {setPaginaAttiva('errori'); tem();}}>
          Tasso Errore
        </button>
        <button style={stileBottoneMenu(paginaAttiva === 'blocco')} onClick={() => setPaginaAttiva('blocco')}>
          Blacklists
        </button>
      </aside>

      <main style={{
        flex: 1,
        padding: '30px',
        minWidth: 0,
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}>

        {/* HEADER STATISTICHE SEMPRE VISIBILE */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2 style={{ margin: 0 }}>Monitoraggio Traffico di Rete</h2>
          <div style={{ display: 'flex', gap: '40px', fontSize: '15px' }}>
            <span>Tempo medio risposta: <b style={{ color: (paginaAttiva === 'tempo') ? '#9292e2' : 'gainsboro', backgroundColor: (paginaAttiva === 'tempo') ? '#0505af' : 'transparent', padding: '3px', borderRadius: '6px', fontSize: '16px' }}>{atr} ms</b></span>
            <span>Tasso di errore: <b style={{ color: (paginaAttiva === 'errori') ? '#cc9192' : 'gainsboro', backgroundColor: (paginaAttiva === 'errori') ? '#720507' : 'transparent', padding: '3px', borderRadius: '6px', fontSize: '16px' }}>{er}%</b> </span>
          </div>
        </div>

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

            <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <SimpleTable defaultHeaders={colonne} rows={datiTraffico} theme='modern-dark' columnBorders={true} />
            </div>
          </>
        )}

        {/* PAGINA 2: GRAFICO TEMPO DI RISPOSTA */}
        {paginaAttiva === 'tempo' && (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80vh', width: '100%' }}>
            <div style={{ backgroundColor: '#1a1f2c', padding: '20px', borderRadius: '6px', border: '1px solid #2d3748' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Andamento dei Tempi di Risposta</h3>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                  <LineChart data={tempoRispostaMedio} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                    <XAxis dataKey="tempo" stroke="#cbd5e1" tick={{ fontSize: 11 }} />
                    <YAxis unit="ms" stroke="#cbd5e1" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1f2c', borderColor: '#2d3748', color: '#fff' }} />
                    <Legend />
                    <Line type="monotone" dataKey="trm" name="Tempo di Risposta (ms)" stroke="#007bff" strokeWidth={2} activeDot={{ r: 6 }} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* PAGINA 3: GRAFICO TASSO ERRORE */}
        {paginaAttiva === 'errori' && (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80vh', width: '100%' }}>
            <div style={{ backgroundColor: '#1a1f2c', padding: '20px', borderRadius: '6px', border: '1px solid #2d3748' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Distribuzione Tasso Errore Medio </h3>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                  <LineChart data={tassoErroreMedio} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                    <XAxis dataKey="tempo" stroke="#cbd5e1" tick={{ fontSize: 11 }} />
                    <YAxis unit="%" stroke="#cbd5e1" domain={[0, 100]} tick={{ fontSize: 13 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1f2c', borderColor: '#2d3748', color: '#fff' }} />
                    <Legend />
                    <Line type="step" dataKey="tem" name="Errore medio per periodo" stroke="#ff4d4f" strokeWidth={2} dot={true} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* PAGINA 4: BLOCCO INDIRIZZI IP E URI */}
        {paginaAttiva === 'blocco' && (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80vh', width: '100%' }}>
            <div style={{ boxSizing: 'border-box', width: '100%', maxWidth: '1000px', margin: '0 auto', backgroundColor: '#1a1f2c', padding: '30px', borderRadius: '8px', border: '1px solid #2d3748', fontFamily: 'sans-serif' }}>

              <div style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', gap: '20px' }}>
                  <input type="text" placeholder="IP da bloccare..." style={{ flexGrow: 1, height: '45px', padding: '0 15px', fontSize: '15px', color: '#ffffff', backgroundColor: '#11151f', border: '1px solid #2d3748', borderRadius: '6px', outline: 'none' }} />
                  <button style={{ width: '140px', height: '45px', fontSize: '14px', fontWeight: '600', letterSpacing: '0.5px', color: 'white', backgroundColor: '#007bff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Blocca</button>
                </div>
                <div style={{ width: '100%' }}>
                  <textarea readOnly placeholder="IP bloccati..." style={{ boxSizing: 'border-box', width: '100%', height: '220px', padding: '15px', color: '#94a3b8', backgroundColor: '#11151f', border: '1px solid #2d3748', borderRadius: '6px', resize: 'none', outline: 'none', fontFamily: 'monospace', fontSize: '13px', overflowY: 'scroll' }}></textarea>
                </div>
              </div>

              <div style={{ marginBottom: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', gap: '20px' }}>
                  <input type="text" placeholder="/URI da bloccare..." style={{ flexGrow: 1, height: '45px', padding: '0 15px', fontSize: '15px', color: '#ffffff', backgroundColor: '#11151f', border: '1px solid #2d3748', borderRadius: '6px', outline: 'none' }} />
                  <button style={{ width: '140px', height: '45px', fontSize: '14px', fontWeight: '600', letterSpacing: '0.5px', color: 'white', backgroundColor: '#007bff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Blocca</button>
                </div>
                <div style={{ width: '100%' }}>
                  <textarea readOnly placeholder="URI bloccati..." style={{ boxSizing: 'border-box', width: '100%', height: '220px', padding: '15px', color: '#94a3b8', backgroundColor: '#11151f', border: '1px solid #2d3748', borderRadius: '6px', resize: 'none', outline: 'none', fontFamily: 'monospace', fontSize: '13px', overflowY: 'scroll' }}></textarea>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* FINESTRA CHE MOSTRA I DETTAGLI DI UNA CERTA RIGA*/}
        {dettagliModal && (
          <div style={stiliModal.overlay} onClick={() => setDettagliModal(null)}>
            <div style={stiliModal.modal} onClick={(e) => e.stopPropagation()}>
              <button style={stiliModal.chiudiBtn} onClick={() => setDettagliModal(null)}>✕</button>
              <h3 style={{ marginTop: 0 }}>Dettagli Connessione</h3>
              <h4 style={stiliModal.sezioneTitolo('white')}>REQUEST</h4>
              <p style={{ margin: '6px 0' }}><b>Metodo:</b> <span style={{ padding: '2px 6px', fontWeight: 'bold' }}>{dettagliModal.connection[0].req_method}</span></p>
              <p style={{ margin: '6px 0' }}><b>Versione:</b> {dettagliModal.connection[0].req_version} | <b>URI: </b> {dettagliModal.connection[0].req_uri}</p>
              <p style={{ margin: '6px 0' }}><b>Loggato il:</b> {dettagliModal.connection[0].created_at}</p>

              <details style={{ marginTop: '10px' }}>
                <summary style={{ cursor: 'pointer', color: '#007bff', fontWeight: 'bold' }}>
                  Visualizza Headers di Richiesta ({dettagliModal.headers.filter(h => h.tipo_header === 'request').length})
                </summary>
                <div style={{ backgroundColor: '#121620', padding: '10px', borderRadius: '4px', marginTop: '8px', border: '1px solid #2d3748', textAlign: 'left'}}>
                  {dettagliModal.headers.filter(h => h.tipo_header === 'request').map((h, i) => (
                    <div key={i} style={{ fontSize: '13px', margin: '4px 0', wordBreak: 'break-all' }}>
                      <b style={{ color: '#cbd5e1' }}>{h.header_nome}:</b> {h.header_valore}
                    </div>
                  ))}
                </div>
              </details>

              <h4 style={stiliModal.sezioneTitolo('white')}>RESPONSE</h4>
              <p style={{ margin: '6px 0' }}>
                <b>Status:</b>
                <span style={stiliModal.badgeCodice(dettagliModal.connection[0].res_code)}>
                  {dettagliModal.connection[0].res_code} {dettagliModal.connection[0].res_phrase}
                </span>
              </p>
              <p style={{ margin: '6px 0' }}><b>Versione:</b> {dettagliModal.connection[0].res_version} | <b>Tempo Risposta:</b> {dettagliModal.connection[0].res_time} ms</p>

              <details style={{ marginTop: '10px' }}>
                <summary style={{ cursor: 'pointer', color: '#007bff', fontWeight: 'bold' }}>
                  Visualizza Headers di Risposta ({dettagliModal.headers.filter(h => h.tipo_header === 'response').length})
                </summary>
                <div style={{ backgroundColor: '#121620', padding: '10px', borderRadius: '4px', marginTop: '8px', border: '1px solid #2d3748', textAlign: 'left'}}>
                  {dettagliModal.headers.filter(h => h.tipo_header === 'response').map((h, i) => (
                    <div key={i} style={{ fontSize: '13px', margin: '4px 0', wordBreak: 'break-all' }}>
                      <b style={{ color: '#cbd5e1' }}>{h.header_nome}:</b> {h.header_valore}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;