import { ClinicalPageHeader } from "../components/clinical/PagePrimitives.jsx";

export const PlaceholderPage = ({ title = "Coming Soon" }) => {
  return (
    <section className="page cc-page">
      <ClinicalPageHeader
        title={title}
        subtitle="This section is available in navigation. Feature content can be added next."
      />
      <article className="card cc-placeholder-card">
        <p>We are preparing this module for your hospital workflow.</p>
      </article>
    </section>
  );
};
