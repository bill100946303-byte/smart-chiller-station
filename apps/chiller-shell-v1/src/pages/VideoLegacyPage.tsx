import { useEffect, useMemo, useRef, useState } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatusPill from "../components/common/StatusPill";
import { zhCN } from "../i18n/zhCN";
import { getAuthSession } from "../services/auth";

type LegacyPlayerInstance = {
  on(event: string, callback: (payload: { encodeMode?: string; errorCode?: number }) => void): void;
  init(canvas: HTMLCanvasElement, video: HTMLVideoElement): void;
  connect?: () => void;
  close?: () => void;
};

type LegacyPlayerConstructor = new (options: {
  wsURL: string;
  rtspURL: string;
  username: string;
  password: string;
}) => LegacyPlayerInstance;

type StreamStatus = "idle" | "loading" | "playing" | "failed";
type StreamRenderMode = "video" | "canvas";

type StreamConfig = {
  id: string;
  name: string;
  wsURL: string;
  rtspURL: string;
};

type StreamState = {
  id: string;
  name: string;
  wsURL: string;
  rtspURL: string;
  status: StreamStatus;
  renderMode: StreamRenderMode;
  error: string | null;
};

const STREAM_CONFIGS: StreamConfig[] = [
  {
    id: "cam-1",
    name: "摄像头 1",
    wsURL: "ws://192.168.111.201/rtspoverwebsocket",
    rtspURL: "rtsp://192.168.111.201:37777/cam/realmonitor?channel=1&subtype=0&proto=Private3"
  },
  {
    id: "cam-2",
    name: "摄像头 2",
    wsURL: "ws://192.168.111.202/rtspoverwebsocket",
    rtspURL: "rtsp://192.168.111.202:37777/cam/realmonitor?channel=1&subtype=0&proto=Private3"
  },
  {
    id: "cam-3",
    name: "摄像头 3",
    wsURL: "ws://192.168.111.203/rtspoverwebsocket",
    rtspURL: "rtsp://192.168.111.203:37777/cam/realmonitor?channel=1&subtype=0&proto=Private3"
  }
];

const PLAYER_SCRIPT_ID = "legacy-player-control-script";
const PLAYER_SCRIPT_SRC = "/module/PlayerControl.js";

function buildInitialStreams(): StreamState[] {
  return STREAM_CONFIGS.map((item) => ({
    ...item,
    status: "idle",
    renderMode: "canvas",
    error: null
  }));
}

function mapStreamTone(status: StreamStatus): "neutral" | "good" | "warn" {
  if (status === "playing") {
    return "good";
  }
  if (status === "failed") {
    return "warn";
  }
  return "neutral";
}

function mapStreamLabel(status: StreamStatus): string {
  if (status === "playing") {
    return zhCN.videoLegacyPage.statusPlaying;
  }
  if (status === "failed") {
    return zhCN.videoLegacyPage.statusFailed;
  }
  if (status === "loading") {
    return zhCN.videoLegacyPage.statusLoading;
  }
  return zhCN.videoLegacyPage.statusIdle;
}

function loadPlayerControlScript(): Promise<LegacyPlayerConstructor> {
  const currentWindow = window as typeof window & {
    PlayerControl?: LegacyPlayerConstructor;
  };
  if (currentWindow.PlayerControl) {
    return Promise.resolve(currentWindow.PlayerControl);
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(PLAYER_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        if (currentWindow.PlayerControl) {
          resolve(currentWindow.PlayerControl);
          return;
        }
        reject(new Error("PlayerControl unavailable after load"));
      });
      existing.addEventListener("error", () => reject(new Error("PlayerControl script failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.id = PLAYER_SCRIPT_ID;
    script.src = PLAYER_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (currentWindow.PlayerControl) {
        resolve(currentWindow.PlayerControl);
        return;
      }
      reject(new Error("PlayerControl unavailable after load"));
    };
    script.onerror = () => reject(new Error("PlayerControl script failed to load"));
    document.body.appendChild(script);
  });
}

export default function VideoLegacyPage() {
  const session = getAuthSession();
  const isAllowedUser = session?.username === "ghb";
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const [streams, setStreams] = useState<StreamState[]>(() => buildInitialStreams());
  const [scriptState, setScriptState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    setStreams(buildInitialStreams());
  }, []);

  useEffect(() => {
    if (!isAllowedUser) {
      setScriptState("failed");
      return;
    }

    let cancelled = false;
    const players: LegacyPlayerInstance[] = [];

    function updateStream(id: string, patch: Partial<StreamState>) {
      setStreams((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    }

    async function setupPlayers() {
      try {
        const PlayerControl = await loadPlayerControlScript();
        if (cancelled) {
          return;
        }
        setScriptState("ready");

        STREAM_CONFIGS.forEach((config, index) => {
          const canvas = canvasRefs.current[index];
          const video = videoRefs.current[index];
          if (!canvas || !video) {
            updateStream(config.id, {
              status: "failed",
              error: zhCN.videoLegacyPage.errorMissingContainer
            });
            return;
          }

          updateStream(config.id, { status: "loading", error: null });
          const player = new PlayerControl({
            wsURL: config.wsURL,
            rtspURL: config.rtspURL,
            username: "admin",
            password: "ln/123456"
          });

          player.on("WorkerReady", () => {
            if (cancelled) {
              return;
            }
            player.connect?.();
          });
          player.on("DecodeStart", (payload) => {
            if (cancelled) {
              return;
            }
            updateStream(config.id, {
              renderMode: payload?.encodeMode === "h264" ? "video" : "canvas"
            });
          });
          player.on("PlayStart", () => {
            if (cancelled) {
              return;
            }
            updateStream(config.id, {
              status: "playing",
              error: null
            });
          });
          player.on("Error", (payload) => {
            if (cancelled) {
              return;
            }
            updateStream(config.id, {
              status: "failed",
              error:
                payload?.errorCode === 101
                  ? zhCN.videoLegacyPage.errorConnectionReset
                  : zhCN.videoLegacyPage.errorPlaybackFailed
            });
            player.close?.();
          });

          player.init(canvas, video);
          players.push(player);
        });
      } catch {
        if (cancelled) {
          return;
        }
        setScriptState("failed");
        setStreams((current) =>
          current.map((item) => ({
            ...item,
            status: "failed",
            error: zhCN.videoLegacyPage.errorScriptFailed
          }))
        );
      }
    }

    setupPlayers();
    return () => {
      cancelled = true;
      players.forEach((player) => player.close?.());
    };
  }, [isAllowedUser]);

  const bannerSummary = useMemo(() => {
    if (!isAllowedUser) {
      return zhCN.videoLegacyPage.bannerUnavailable;
    }
    if (scriptState === "failed") {
      return zhCN.videoLegacyPage.bannerFailed;
    }
    if (scriptState === "ready") {
      return zhCN.videoLegacyPage.bannerReady;
    }
    return zhCN.videoLegacyPage.bannerLoading;
  }, [isAllowedUser, scriptState]);

  const detailLines = [
    `${zhCN.videoLegacyPage.detailRuntime}: /module/PlayerControl.js`,
    `${zhCN.videoLegacyPage.detailProtocol}: RTSP over WebSocket`,
    `${zhCN.videoLegacyPage.detailScope}: ${zhCN.videoLegacyPage.detailScopeValue}`
  ];

  return (
    <div className="video-legacy-page page-enter">
      <SourceStatusBanner
        summary={bannerSummary}
        warn={!isAllowedUser || scriptState === "failed"}
        detailLines={detailLines}
        detailLinesCompact={detailLines}
      />

      <section className="video-legacy-header">
        <div>
          <h2>{zhCN.videoLegacyPage.heading}</h2>
          <p>{zhCN.videoLegacyPage.subtitle}</p>
        </div>
        <div className="video-legacy-notes">
          <article>
            <label>{zhCN.videoLegacyPage.noteAccess}</label>
            <strong>{zhCN.videoLegacyPage.noteAccessValue}</strong>
          </article>
          <article>
            <label>{zhCN.videoLegacyPage.noteSecurity}</label>
            <strong>{zhCN.videoLegacyPage.noteSecurityValue}</strong>
          </article>
        </div>
      </section>

      {!isAllowedUser ? (
        <SectionCard title={zhCN.videoLegacyPage.sectionGate}>
          <div className="video-legacy-empty">
            <strong>{zhCN.videoLegacyPage.gateTitle}</strong>
            <p>{zhCN.videoLegacyPage.gateBody}</p>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title={zhCN.videoLegacyPage.sectionStreams}>
          <div className="video-legacy-grid">
            {streams.map((stream, index) => (
              <article key={stream.id} className="video-legacy-card">
                <header>
                  <div>
                    <strong>{stream.name}</strong>
                    <small>{stream.wsURL}</small>
                  </div>
                  <StatusPill label={mapStreamLabel(stream.status)} tone={mapStreamTone(stream.status)} />
                </header>

                <div className="video-legacy-stage">
                  <canvas
                    ref={(node) => {
                      canvasRefs.current[index] = node;
                    }}
                    className={stream.renderMode === "canvas" ? "video-legacy-canvas active" : "video-legacy-canvas"}
                  />
                  <video
                    ref={(node) => {
                      videoRefs.current[index] = node;
                    }}
                    className={stream.renderMode === "video" ? "video-legacy-video active" : "video-legacy-video"}
                    autoPlay
                    muted
                    playsInline
                  />
                </div>

                <div className="video-legacy-meta">
                  <article>
                    <label>{zhCN.videoLegacyPage.metaProtocol}</label>
                    <strong>{zhCN.videoLegacyPage.metaProtocolValue}</strong>
                  </article>
                  <article>
                    <label>{zhCN.videoLegacyPage.metaRtsp}</label>
                    <strong>{stream.rtspURL}</strong>
                  </article>
                </div>

                {stream.error ? <p className="empty-hint">{stream.error}</p> : null}
              </article>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
