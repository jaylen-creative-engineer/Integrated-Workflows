export const metadata = {
  title: "Privacy Policy | Integrated Workflows",
  description: "Privacy policy for Integrated Workflows WHOOP integration",
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        fontFamily: "'Crimson Pro', Georgia, serif",
        padding: "3rem 2rem",
        maxWidth: "680px",
        margin: "0 auto",
        lineHeight: 1.7,
        color: "#2c2c2c",
        background: "linear-gradient(180deg, #fdfcfa 0%, #f5f3ef 100%)",
        minHeight: "100vh",
      }}
    >
      <header style={{ marginBottom: "2.5rem", borderBottom: "1px solid #d4cfc7", paddingBottom: "1.5rem" }}>
        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            margin: 0,
            color: "#1a1a1a",
          }}
        >
          Privacy Policy
        </h1>
        <p style={{ fontSize: "0.9rem", color: "#6b6560", marginTop: "0.5rem" }}>
          Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </header>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={sectionHeadingStyle}>Overview</h2>
        <p>
          Integrated Workflows ("we", "our", or "the application") respects your privacy and is 
          committed to protecting your personal data. This privacy policy explains how we collect, 
          use, and safeguard information when you use our WHOOP integration service.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={sectionHeadingStyle}>Data We Collect</h2>
        <p>When you authorize our application with WHOOP, we access the following data:</p>
        <ul style={listStyle}>
          <li><strong>Sleep Data</strong> — Sleep start/end times, sleep stages, and sleep performance metrics</li>
          <li><strong>Recovery Data</strong> — Recovery scores and associated physiological metrics</li>
        </ul>
        <p>
          We only request access to the specific WHOOP data scopes required for the application 
          to function. We do not access workout, strain, or other WHOOP data unless explicitly stated.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={sectionHeadingStyle}>How We Use Your Data</h2>
        <p>Your WHOOP data is used solely to:</p>
        <ul style={listStyle}>
          <li>Generate personalized energy schedules based on your sleep and recovery</li>
          <li>Process webhook events to update your energy model in real-time</li>
        </ul>
        <p>
          We do not sell, rent, or share your personal data with third parties for marketing purposes.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={sectionHeadingStyle}>Data Storage &amp; Security</h2>
        <p>
          OAuth tokens are stored securely and used only to authenticate requests to the WHOOP API 
          on your behalf. We implement industry-standard security measures to protect your data 
          from unauthorized access, alteration, or disclosure.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={sectionHeadingStyle}>Data Retention</h2>
        <p>
          We retain your WHOOP data only for as long as necessary to provide the service. 
          You may revoke access at any time through your WHOOP app settings, which will 
          invalidate our access tokens and prevent further data collection.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={sectionHeadingStyle}>Your Rights</h2>
        <p>You have the right to:</p>
        <ul style={listStyle}>
          <li>Revoke our access to your WHOOP data at any time</li>
          <li>Request information about what data we have collected</li>
          <li>Request deletion of your data from our systems</li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={sectionHeadingStyle}>Changes to This Policy</h2>
        <p>
          We may update this privacy policy from time to time. We will notify you of any 
          significant changes by updating the "Last updated" date at the top of this page.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={sectionHeadingStyle}>Contact</h2>
        <p>
          If you have any questions about this privacy policy or our data practices, 
          please contact us through the application.
        </p>
      </section>

      <footer
        style={{
          marginTop: "3rem",
          paddingTop: "1.5rem",
          borderTop: "1px solid #d4cfc7",
          fontSize: "0.85rem",
          color: "#6b6560",
        }}
      >
        <p>© {new Date().getFullYear()} Integrated Workflows. All rights reserved.</p>
      </footer>
    </main>
  );
}

const sectionHeadingStyle = {
  fontSize: "1.25rem",
  fontWeight: 600,
  color: "#1a1a1a",
  marginBottom: "0.75rem",
  marginTop: 0,
};

const listStyle = {
  paddingLeft: "1.25rem",
  marginTop: "0.5rem",
  marginBottom: "1rem",
};



