import { useState, useEffect } from 'react';
import { SimpleTable } from '@simple-table/react';
import '@simple-table/react/styles.css';

const INTERVALLO_AGGIORNAMENTO = 5000;

function App() {
  // Allineati i tipi del mockup (code e tempo come numeri reali)
  const [datiTraffico, setDatiTraffico] = useState([
    { metodo: 'Caricamento...', uri: 'Attendi...', code: 0, ip: "0.0.0.0", tempo: 0 }
  ]);

  const [atr, setAtr] = useState('...');

  const [er, setEr] = useState('0');

  const colonne = [
    { label: 'Data', accessor: 'data', minWidth: 150, width: "1.2fr", type: "date", filterable: true, align: "left"},
    { label: 'Ora', accessor: 'ora', minWidth: 150, width: "1.2fr", filterable: false, align: "left"},
    { label: 'Metodo', accessor: 'metodo', minWidth: 150, width: "1.2fr", type: "string", filterable: true, align: "left"},
    { label: 'URI', accessor: 'uri', minWidth: 150, width: "1.2fr", type: "string", filterable: false, align: "left"},
    { label: 'Code', accessor: 'code', minWidth: 150, width: "1.2fr", type: "number", filterable: true, filterType: 'number',align: "left"},
    { label: 'IP', accessor: 'ip', minWidth: 150, width: "1.2fr", type: "string", filterable: false, align: "left"},
    { label: 'Tempo (ms)', accessor: 'tempo', minWidth: 150, width: "1.2fr", type: "number", filterable: true, align: "left"}
  ]; 

  useEffect(() => {
    const caricaAtr = () => {
      fetch(`http://192.168.1.100:5554/atr.php`)
        .then(res => res.json())
        .then(d => setAtr(Number(d.data[0].atr).toFixed(3)))
        .catch(err => console.error("Errore ATR:", err));
    };

    const caricaEr = () => {
      fetch(`http://192.168.1.100:5554/er.php`)
        .then(res => res.json())
        .then(d => setEr(Number(d.data[0].er).toFixed(2))) // Corretto setTe in setEr
        .catch(err => console.error("Errore Er:", err));
    };

    const caricaTraffico = () => {
      fetch(`http://192.168.1.100:5554/api.php`)
        .then(res => res.json())
        .then(d => setDatiTraffico(d.data))
        .catch(err => console.error("Errore Traffico:", err));
    };

    caricaAtr();
    caricaEr();
    caricaTraffico();

    const intervalId = setInterval(() => {
      caricaAtr();
      caricaEr();
      caricaTraffico();
    }, INTERVALLO_AGGIORNAMENTO);

    return () => clearInterval(intervalId);
  }, []);

  // useEffect(() => {
  //   try {
  //     fetch(`https://192.168.1.100/atr.php`)
  //     .then(res => res.json())
  //     .then(d => setAtr(Number(d.data[0].atr).toFixed(3)));
  //   } catch (error) {
  //     console.error("Si è verificato un errore durante la chiamata:", error);
  //   };
  // }, []);

  // useEffect(() => {
  //   try {
  //     fetch(`https://192.168.1.100/er.php`)
  //     .then(res => res.json())
  //     .then(d => setTe(Number(d.data[0].er).toFixed(2)));
  //   } catch (error) {
  //     console.error("Si è verificato un errore durante la chiamata:", error);
  //   };
  // }, []);

  // useEffect(() => {
  //   try {
  //     fetch(`https://192.168.1.100/api.php`)
  //     .then(res => res.json())
  //     .then(d => setDatiTraffico(d.data));
  //   } catch (error) {
  //     console.error("Si è verificato un errore durante la chiamata:", error);
  //   };
  // }, []);

  return (
    <div style={{ padding: '30px' }}>
      <h2>Monitoraggio Traffico di Rete</h2>
      <br />
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <span>Tempo medio risposta: <b>{atr}</b> ms</span>
        <span>Tasso di errore: <b>{er}</b> %</span>
      </div>
      <br /><br />

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
