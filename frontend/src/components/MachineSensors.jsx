import { useState } from 'react';
import axios from 'axios';
import ConfirmModal from './ConfirmModal';

function MachineSensors({ sensors, machineId, onRefresh }) {
  // Stavy pro modály
  const [selectedSensor, setSelectedSensor] = useState(null); // Pro detail
  const [sensorToDetach, setSensorToDetach] = useState(null); // Pro odpojení

  // Funkce pro odpojení senzoru
  const handleDetach = async () => {
    try {
      await axios.post(`http://127.0.0.1:8000/machines/${machineId}/sensors/${sensorToDetach.id_sensor}/detach`);
      onRefresh(); // Aktualizuje data v rodiči (MachineDetail)
    } catch (error) {
      alert("Chyba při odpojování senzoru.");
    } finally {
      setSensorToDetach(null);
    }
  };

  return (
    <div>
      <div className="table-wrapper">
        {sensors.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            K tomuto stroji nejsou zatím přiřazeny žádné senzory.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sériové číslo</th>
                <th>Model / Popis</th>
                <th>Pozice na stroji</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Akce</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={s.id_sensor}>
                  <td><strong>{s.serial_number}</strong></td>
                  <td>{s.description}</td>
                  {/* Místo "Přiřazený stroj" (víme, kde jsme) zobrazujeme Pozici */}
                  <td>{s.position || '—'}</td> 
                  <td>
                    <span className={`role-badge ${s.status}`}>
                      {s.status === 'available' ? 'K dispozici' : s.status === 'active' ? 'Aktivní' : 'Údržba'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button className="btn-small-edit" onClick={() => setSelectedSensor(s)}>Detail</button>
                      <button 
                        className="btn-small-delete" 
                        onClick={() => setSensorToDetach(s)}
                        title="Odpojit od stroje"
                      >
                        Odpojit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODÁL: DETAIL SENZORU (Read-Only) */}
      {selectedSensor && (
        <div className="modal-overlay">
          <div className="modal-content sensor-detail-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: 'var(--br-orange)' }}>Detail senzoru</h2>
              <span className={`role-badge ${selectedSensor.status}`}>{selectedSensor.status}</span>
            </div>
            
            <div className="detail-grid">
              <div className="detail-item"><label>Sériové číslo</label><p>{selectedSensor.serial_number}</p></div>
              <div className="detail-item"><label>Model</label><p>{selectedSensor.description}</p></div>
              <div className="detail-item"><label>Vzorkování</label><p>{selectedSensor.sampling_rate ? `${selectedSensor.sampling_rate} Hz` : '-'}</p></div>
              <div className="detail-item"><label>Kalibrace</label><p>{selectedSensor.calibration_date || 'Neznámá'}</p></div>
              <div className="detail-item"><label>Pozice</label><p>{selectedSensor.position || '-'}</p></div>
              <div className="detail-item"><label>ID Senzoru</label><p>#{selectedSensor.id_sensor}</p></div>
            </div>

            <div className="modal-actions" style={{ marginTop: '30px' }}>
              <button className="btn-cancel" onClick={() => setSelectedSensor(null)}>Zavřít</button>
            </div>
          </div>
        </div>
      )}

      {/* MODÁL: POTVRZENÍ ODPOJENÍ */}
      <ConfirmModal 
        isOpen={!!sensorToDetach}
        onClose={() => setSensorToDetach(null)}
        onConfirm={handleDetach}
        title="Odpojit senzor"
        message={`Opravdu chcete odpojit senzor ${sensorToDetach?.serial_number} od tohoto stroje? Senzor bude přesunut do stavu "K dispozici" (Sklad).`}
        confirmText="Odpojit"
      />
    </div>
  );
}

export default MachineSensors;