(async function loadSimulatorDataAndScripts() {
  const status = document.createElement("div");
  status.id = "appDataLoadStatus";
  status.style.cssText = "position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font:600 15px Arial,sans-serif;";
  status.textContent = "Memuat data perhitungan…";
  document.body.appendChild(status);

  const scriptFiles = [
    "js/xlsx.bundle.js",
    "js/chart.umd.min.js?v=202608220900",
    "js/dom-to-pptx.bundle.js?v=20260928-preserve-row-height",
    "js/pptxgen.bundle.js",
    "js/scenarios-core.js?v=202611020001",
    "js/competency-upgrade.js?v=20260910",
    "js/competency-upgrade-excel.js?v=20260910",
    "js/export-gslides.js?v=202608180005",
    "js/audit-excel.js?v=202608180005",
    "js/global-sim-excel.js?v=202608210836",
    "js/dynamic-market-excel.js?v=20260910-simulation-insights",
    "js/idrg-map-data.js?v=20261107-clean-scatter",
    "js/service-insights.js?v=20260918-layout-fix",
    "js/table-copy.js?v=20260910-no-highlight",
    "js/app.js?v=20261107-nbr-formula"
  ];

  function appendScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Gagal memuat ${src}`));
      document.body.appendChild(script);
    });
  }

  try {
    if (!window.DecompressionStream) throw new Error("Browser ini belum mendukung pembacaan data terkompresi. Gunakan browser terbaru.");
    const response = await fetch("js/data.json.gz?v=20261107-formula-nbr", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Data aplikasi gagal diunduh (HTTP ${response.status}).`);
    const compressed = await response.arrayBuffer();
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
    const datasets = JSON.parse(await new Response(stream).text());
    if (!datasets.okt_oct || !datasets.jan_des) throw new Error("Dataset periode uji coba dan 2025 tidak lengkap.");
    window.marketSimulatorDatasets = datasets;
    window.marketSimulatorData = datasets.okt_oct;
    for (const src of scriptFiles) await appendScript(src);
    status.remove();
  } catch (error) {
    console.error("Gagal menyiapkan dataset aplikasi", error);
    status.style.color = "#991b1b";
    status.style.padding = "24px";
    status.style.textAlign = "center";
    status.textContent = `Aplikasi belum dapat dibuka. ${error.message}`;
  }
})();
