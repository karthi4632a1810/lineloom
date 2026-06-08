import { PatientRecordsPage } from "../PatientRecordsPage.jsx";

/** Patients module — uses records search; styled via global nf overrides below. */
export const PatientsHubPage = () => (
  <div className="nf-patients-embed">
    <PatientRecordsPage />
  </div>
);
