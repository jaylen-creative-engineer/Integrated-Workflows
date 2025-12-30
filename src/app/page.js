export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "720px" }}>
      <h1>Integrated Workflows API</h1>
      <p>The energy schedule endpoint is live.</p>

      <h2>POST /api/energy</h2>
      <p>
        Send a JSON body with <code>sleep</code> and <code>recovery</code> objects
        (WHOOP API format) to compute an energy schedule.
      </p>

      <h3>Example curl</h3>
      <pre
        style={{
          background: "#1e1e1e",
          color: "#d4d4d4",
          padding: "1rem",
          borderRadius: "6px",
          overflowX: "auto",
        }}
      >{`curl -X POST http://localhost:3000/api/energy \\
  -H "Content-Type: application/json" \\
  -d '{
    "sleep": {
      "start": "2022-04-24T02:25:44.774Z",
      "end": "2022-04-24T10:25:44.774Z",
      "timezone_offset": "-05:00",
      "score": {
        "sleep_performance_percentage": 98,
        "sleep_consistency_percentage": 90,
        "sleep_needed": { "need_from_sleep_debt_milli": 352230 }
      }
    },
    "recovery": {
      "score": { "recovery_score": 44 }
    },
    "chronotypeOffsetHours": 0.5
  }'`}</pre>

      <h3>Response</h3>
      <p>Returns an <code>EnergyModelOutput</code> JSON with wake time, day mode, capacity, and energy segments.</p>
    </main>
  );
}



