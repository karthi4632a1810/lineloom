export const PlaceholderPage = ({ title = "Coming Soon" }) => {
  return (
    <section className="page">
      <h2>{title}</h2>
      <article className="card">
        <p>This section is ready in menu and layout. Feature content can be added next.</p>
      </article>
    </section>
  );
};
