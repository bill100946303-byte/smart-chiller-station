import { config } from "../src/config.js";
import { getAnomalySummary } from "../src/services/anomalyService.js";
import { getDashboardOverview, getDashboardTrends } from "../src/services/dashboardService.js";
import { getRecommendations } from "../src/services/recommendationService.js";
import { getTopology } from "../src/services/topologyService.js";

async function run() {
  const siteId = process.argv[2] || config.defaultSiteId;

  const anomalies = await getAnomalySummary(config, siteId);
  const overview = await getDashboardOverview(config, siteId, anomalies);
  const trends = await getDashboardTrends(config, siteId, "24h");
  const topology = await getTopology(config, siteId);
  const recommendations = await getRecommendations(config, siteId, overview, anomalies);

  const result = {
    siteId,
    overview,
    trends,
    anomalies,
    topology,
    recommendations
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

run().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
