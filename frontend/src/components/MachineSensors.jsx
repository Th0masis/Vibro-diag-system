import { useEffect, useState } from 'react';
import axios from 'axios';
import ConfirmModal from './ConfirmModal';

function MachineSensors({ sensors, machineId, onRefresh, preselectedSensorId, onPreselectedSensorHandled }) {
  // Stavy pro panely
  const [selectedSensor, setSelectedSensor] = useState(null); // Pro detail
  const [sensorToDetach, setSensorToDetach] = useState(null); // Pro odpojení

  // Funkce pro odpojení senzoru
  const handleDetach = async () => {
    try {
      await axios.post(`/machines/${machineId}/sensors/${sensorToDetach.id_sensor}/detach`);
      onRefresh(); // Aktualizuje data v rodiči (MachineDetail)
    } catch (error) {
      alert('Failed to detach sensor. Please try again.');
    } finally {
      setSensorToDetach(null);
    }
  };

  useEffect(() => {
    if (!preselectedSensorId) return;

    const sensor = sensors.find((s) => s.id_sensor === preselectedSensorId);
    if (sensor) {
      setSelectedSensor(sensor);
      if (onPreselectedSensorHandled) onPreselectedSensorHandled();
    }
  }, [preselectedSensorId, sensors, onPreselectedSensorHandled]);

  return (
    <div>
      <div className="table-wrapper">
        {sensors.length === 0 ? (
          <div className="machine-sensors-empty-state">
            No sensors assigned to this machine yet.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Serial number</th>
                <th>Model / Description</th>
                <th>Position on machine</th>
                <th>Status</th>
                <th className="machine-sensors-actions-head">Actions</th>
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
                      {s.status === 'available' ? 'Available' : s.status === 'active' ? 'Active' : 'Maintenance'}
                    </span>
                  </td>
                  <td className="machine-sensors-actions-cell">
                    <div className="machine-sensors-actions-wrap">
                      <button
                        className="sensor-btn sensor-btn-detail"
                        onClick={() => setSelectedSensor(s)}
                        title="View sensor details"
                        aria-label="View sensor details"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                      </button>
                      <button 
                        className="sensor-btn sensor-btn-delete" 
                        onClick={() => setSensorToDetach(s)}
                        title="Detach from machine"
                        aria-label="Detach sensor"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODÁL: POTVRZENÍ ODPOJENÍ */}
      <ConfirmModal 
        isOpen={!!sensorToDetach}
        onClose={() => setSensorToDetach(null)}
        onConfirm={handleDetach}
        title="Detach sensor"
        message={`Detach sensor ${sensorToDetach?.serial_number} from this machine? It will become available in inventory.`}
        confirmText="Detach"
      />

      {selectedSensor && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '760px', width: '92%', textAlign: 'left' }}>
            <div className="machine-sensors-detail-header">
              <h2 className="machine-sensors-detail-title">Sensor detail</h2>
              <div className="machine-sensors-detail-actions">
                <span className={`role-badge ${selectedSensor.status}`}>{selectedSensor.status}</span>
                <button className="modal-close-btn" onClick={() => setSelectedSensor(null)} title="Close">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="detail-grid">
              <div className="detail-item"><label>Serial number</label><p>{selectedSensor.serial_number}</p></div>
              <div className="detail-item"><label>Model</label><p>{selectedSensor.description}</p></div>
              <div className="detail-item"><label>Sampling rate</label><p>{selectedSensor.sampling_rate ? `${selectedSensor.sampling_rate} Hz` : '-'}</p></div>
              <div className="detail-item"><label>Calibration</label><p>{selectedSensor.calibration_date || 'Unknown'}</p></div>
              <div className="detail-item"><label>Position</label><p>{selectedSensor.position || '-'}</p></div>
              <div className="detail-item"><label>Channel</label><p>{selectedSensor.channel_no ?? '-'}</p></div>
              <div className="detail-item"><label>Module path</label><p>{selectedSensor.module_path || '-'}</p></div>
              <div className="detail-item"><label>Sensor ID</label><p>#{selectedSensor.id_sensor}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MachineSensors;