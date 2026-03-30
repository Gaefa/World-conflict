import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  actionDeck,
  advanceStateByTime,
  applyAction,
  canAffordAction,
  classifyRegion,
  createInitialState,
  describeCosts,
  describeDelta,
  GameState,
  getSelectedRegion,
  getWorldMetrics,
  resolveTurn,
  selectRegion,
  startCampaign,
  statusLabel
} from "@codex/game-core";

export default function App() {
  const [game, setGame] = useState<GameState>(createInitialState);
  const [showMission, setShowMission] = useState(true);

  const selectedRegion = getSelectedRegion(game);
  const metrics = useMemo(() => getWorldMetrics(game.regions), [game.regions]);

  useEffect(() => {
    if (game.mode !== "active") {
      return undefined;
    }

    const timer = setInterval(() => {
      setGame((current) => advanceStateByTime(current, 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [game.mode]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        {showMission ? (
          <View style={styles.missionCard}>
            <Text style={styles.kicker}>Mission Brief</Text>
            <Text style={styles.title}>Mobile command shell</Text>
            <Text style={styles.body}>
              Shared game-core is already connected. This mobile app can run the
              same turns, theaters, resources and win/loss logic as web.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                setShowMission(false);
                setGame((current) => startCampaign(current));
              }}
            >
              <Text style={styles.primaryButtonText}>Start mission</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.headerCard}>
          <View>
            <Text style={styles.kicker}>Codex Mobile</Text>
            <Text style={styles.title}>Conflict Simulator</Text>
          </View>
          <View style={styles.headerStats}>
            <Metric label="Turn" value={`${Math.min(game.turn, game.maxTurns)}/${game.maxTurns}`} />
            <Metric label="Programs" value={`${game.operationsLeft}`} />
            <Metric label="Tension" value={`${metrics.worldTension}`} />
            <Metric label="Timer" value={`${Math.ceil(game.countdownMs / 1000)}s`} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.kicker}>Theaters</Text>
          <Text style={styles.sectionTitle}>Select focus region</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {game.regions.map((region) => (
                <Pressable
                  key={region.id}
                  onPress={() => setGame((current) => selectRegion(current, region.id))}
                  style={[
                    styles.theaterChip,
                    region.id === game.selectedRegionId && styles.theaterChipActive
                  ]}
                >
                  <Text style={styles.theaterChipTitle}>{region.name}</Text>
                  <Text style={styles.theaterChipMeta}>
                    {statusLabel[classifyRegion(region)]} · {region.tension}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.card}>
          <Text style={styles.kicker}>Selected Region</Text>
          <Text style={styles.sectionTitle}>{selectedRegion.name}</Text>
          <Text style={styles.body}>{selectedRegion.summary}</Text>
          <Text style={styles.metaLine}>
            {statusLabel[classifyRegion(selectedRegion)]} · Stability {selectedRegion.stability} · Tension {selectedRegion.tension}
          </Text>
          <Text style={styles.metaLine}>Flashpoint: {selectedRegion.flashpoint}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.kicker}>Programs</Text>
          <Text style={styles.sectionTitle}>Launch from mobile</Text>
          {actionDeck.map((action) => {
            const disabled =
              game.mode !== "active" ||
              game.operationsLeft <= 0 ||
              !canAffordAction(game.resources, action.costs);

            return (
              <View key={action.id} style={styles.actionCard}>
                <Text style={styles.actionTitle}>{action.label}</Text>
                <Text style={styles.body}>{action.description}</Text>
                <Text style={styles.metaLine}>{describeDelta(action.delta)}</Text>
                <Text style={styles.metaLine}>{describeCosts(action.costs)}</Text>
                <Pressable
                  disabled={disabled}
                  onPress={() => setGame((current) => applyAction(current, action.id))}
                  style={[styles.secondaryButton, disabled && styles.buttonDisabled]}
                >
                  <Text style={styles.secondaryButtonText}>Apply</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.kicker}>Turn Control</Text>
          <Text style={styles.sectionTitle}>Resolve world phase</Text>
          <Text style={styles.body}>{game.briefing}</Text>
          <Pressable
            onPress={() => setGame((current) => resolveTurn(current))}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>End turn</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#07111d"
  },
  container: {
    padding: 18,
    gap: 14
  },
  missionCard: {
    backgroundColor: "#111d31",
    borderRadius: 24,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  headerCard: {
    backgroundColor: "#0b1627",
    borderRadius: 24,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  headerStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metric: {
    minWidth: 76,
    padding: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)"
  },
  metricLabel: {
    color: "#8f9db4",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 4
  },
  metricValue: {
    color: "#f5ede1",
    fontSize: 20,
    fontWeight: "700"
  },
  card: {
    backgroundColor: "#0b1627",
    borderRadius: 24,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  kicker: {
    color: "#ffb26d",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.4
  },
  title: {
    color: "#f5ede1",
    fontSize: 28,
    fontWeight: "700"
  },
  sectionTitle: {
    color: "#f5ede1",
    fontSize: 22,
    fontWeight: "700"
  },
  body: {
    color: "#d2d9e3",
    fontSize: 15,
    lineHeight: 22
  },
  metaLine: {
    color: "#9fb0c7",
    fontSize: 13,
    lineHeight: 18
  },
  chipRow: {
    flexDirection: "row",
    gap: 10
  },
  theaterChip: {
    width: 180,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)"
  },
  theaterChipActive: {
    borderWidth: 1,
    borderColor: "rgba(255,176,109,0.5)"
  },
  theaterChipTitle: {
    color: "#f5ede1",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6
  },
  theaterChipMeta: {
    color: "#9fb0c7",
    fontSize: 13
  },
  actionCard: {
    marginTop: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 6
  },
  actionTitle: {
    color: "#f5ede1",
    fontSize: 18,
    fontWeight: "700"
  },
  primaryButton: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "#ff9b59",
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#1d140d",
    fontSize: 16,
    fontWeight: "700"
  },
  secondaryButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(77,223,178,0.14)",
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#d9fff4",
    fontSize: 15,
    fontWeight: "700"
  },
  buttonDisabled: {
    opacity: 0.45
  }
});
