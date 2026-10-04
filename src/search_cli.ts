async function main(): Promise<void> {
  const query = process.argv.slice(2).join(" ");
  if (!query) throw new Error("Pass a search query");

  const response = await fetch("http://localhost:3000/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, limit: 5 })
  });
  const result: unknown = await response.json();
  if (!response.ok) throw new Error(`Search failed with HTTP ${response.status}`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
