import Navbar from "../components/Navbar";

export default function Dashboard() {
  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-figma-surface rounded-lg p-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to The Childkeeper's Log
          </h1>
          <p className="text-lg text-figma-text-secondary mb-8">
            Track your hours, manage families, and generate reports
            effortlessly.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#beff8b] rounded-lg p-6">
              <h2 className="text-xl font-semibold text-figma-bg mb-2">
                Manage Families
              </h2>
              <p className="text-figma-bg mb-4">
                Add families and set hourly rates based on the number of
                children.
              </p>
              <a
                href="/families"
                className="inline-block px-4 py-2 bg-[#b0b1fe] text-figma-bg rounded hover:bg-figma-accent-hover transition"
              >
                Go to Families
              </a>
            </div>

            <div className="bg-figma-elevated rounded-lg p-6 border border-figma-border">
              <h2 className="text-xl font-semibold text-white mb-2">
                Log Hours
              </h2>
              <p className="text-figma-text-secondary mb-4">
                Record your time with start and end times. Earnings are
                calculated automatically.
              </p>
              <a
                href="/log-hours"
                className="inline-block px-4 py-2 bg-[#ffff6b] text-figma-bg rounded hover:bg-figma-accent-hover transition"
              >
                Log Hours
              </a>
            </div>

            <div className="bg-[#b0b1fe] rounded-lg p-6">
              <h2 className="text-xl font-semibold text-figma-bg mb-2">
                Reports
              </h2>
              <p className="text-figma-bg mb-4">
                Generate summaries and export monthly reports as PDF.
              </p>
              <a
                href="/reports"
                className="inline-block px-4 py-2 bg-[#beff8b] text-figma-bg rounded hover:opacity-90 transition"
              >
                View Reports
              </a>
            </div>
          </div>

          <div className="mt-12 bg-figma-elevated rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              Getting Started
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-figma-text-secondary">
              <li>Set up your families and configure rates for each</li>
              <li>Log your hours whenever you complete a job</li>
              <li>Review your entries anytime</li>
              <li>Generate monthly reports for invoicing</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
