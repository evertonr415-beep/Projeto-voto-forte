import AuthClient from "../auth-client";

export default function FullSystemPage() {
  return (
    <>
      <style>{`
        .dashboard-grid > .panel.territorial {
          display: none !important;
        }
      `}</style>
      <AuthClient />
    </>
  );
}
