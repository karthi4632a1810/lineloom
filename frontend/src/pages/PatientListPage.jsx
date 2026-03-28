import { useAsyncData } from "../hooks/useAsyncData";
import { fetchHisPatients } from "../services/hisService";

export const PatientListPage = () => {
  const { data, isLoading, error, reload } = useAsyncData(fetchHisPatients, []);
  const patients = data ?? [];

  if (isLoading) {
    return <section className="page">Loading patients from HIS...</section>;
  }
  if (error) {
    return (
      <section className="page">
        <p className="error-text">{error}</p>
        <button type="button" onClick={reload}>
          Retry
        </button>
      </section>
    );
  }
  if (!patients.length) {
    return <section className="page">No OP/IP patients available.</section>;
  }

  return (
    <section className="page">
      <h2>Patient List (HIS)</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Patient ID</th>
              <th>Visit ID</th>
              <th>Name</th>
              <th>Department</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={`${patient.patient_id}-${patient.visit_id}`}>
                <td>{patient.patient_id}</td>
                <td>{patient.visit_id}</td>
                <td>{patient.name}</td>
                <td>{patient.department}</td>
                <td>{patient.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
