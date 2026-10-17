import { BrandLogo } from "./brand";

export default function Home() {
  return <main className="access-page">
    <div className="access-story">
      <BrandLogo />
      <div className="access-story-copy">
        <p className="access-eyebrow">YOUR PAYROLL, WITH CLARITY</p>
        <h1>A calmer way<br />to manage payday.</h1>
        <p>People, records, and approvals.<br />Together in one secure workspace.</p>
      </div>
      <p className="access-attribution">Developed by <strong>ETL GIS Consulting LLC</strong></p>
    </div>
    <section className="access-panel" aria-labelledby="access-heading">
      <div className="access-card">
        <span className="access-emblem" aria-hidden="true">P</span>
        <p className="access-eyebrow">WELCOME TO PAYCORE</p>
        <h2 id="access-heading">Your workspace is being prepared.</h2>
        <p>Secure sign-in will be available once your organization’s account is connected.</p>
        <div className="access-status"><span aria-hidden="true" />Account setup in progress</div>
        <p className="access-note">No payroll information is collected on this page.</p>
      </div>
    </section>
  </main>;
}
