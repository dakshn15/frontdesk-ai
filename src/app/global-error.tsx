"use client";

/** The last resort, when even the root layout fails. It brings its own html and body. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: 420,
          margin: "15vh auto",
          padding: "0 16px",
          color: "#1c1917",
        }}
      >
        <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
        <p style={{ color: "#57534e" }}>
          FrontDesk AI didn&apos;t load. Try again in a moment.
          {error.digest ? ` Reference: ${error.digest}.` : ""}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8 }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
