export default function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-6">
      <img
        src="/CG_App_Icon.png"
        alt="CG Dynamics"
        className="w-28 h-28 rounded-2xl shadow-[0_0_40px_rgba(45,212,191,0.15)]"
      />
      <div className="text-center">
        <h1 className="text-4xl font-bold text-brand-accent tracking-tight m-0">
          CG Dynamics
        </h1>
        <p className="mt-3 text-brand-primary text-xs tracking-[0.35em] uppercase font-medium">
          Business Intelligence Platform
        </p>
      </div>
    </div>
  )
}
