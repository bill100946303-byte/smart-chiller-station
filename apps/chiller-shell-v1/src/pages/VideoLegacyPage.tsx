import { useEffect, useMemo, useRef, useState } from "react";
import SectionCard from "../components/common/SectionCard";
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
    `${zhCN.videoLegacyPage.detailRuntime}: 已配置`,
    `${zhCN.videoLegacyPage.detailProtocol}: 已配置`,
    `${zhCN.videoLegacyPage.detailScope}: ${zhCN.videoLegacyPage.detailScopeValue}`
  ];
  const playingCount = streams.filter((stream) => stream.status === "playing").length;
  const loadingCount = streams.filter((stream) => stream.status === "loading").length;
  const failedCount = streams.filter((stream) => stream.status === "failed").length;
  const accessLabel = !isAllowedUser
    ? "未授权"
    : scriptState === "ready"
      ? "接入就绪"
      : scriptState === "failed"
        ? "接入异常"
        : "接入中";
  const renderModeLabel = streams.some((stream) => stream.renderMode === "video")
    ? streams.some((stream) => stream.renderMode === "canvas")
      ? "混合渲染"
      : "视频直出"
    : "画布解码";
  const videoCommandTags = [
    { label: "接入态", value: accessLabel },
    { label: "播放中", value: `${playingCount}/${streams.length}` },
    { label: "异常流", value: `${failedCount}` },
    { label: "渲染", value: renderModeLabel }
  ];
  const videoWorkspaceTitle = !isAllowedUser
    ? zhCN.videoLegacyPage.gateTitle
    : `监看工作区 · ${playingCount}/${streams.length} 路已播放`;
  const videoWorkspaceBody = !isAllowedUser
    ? zhCN.videoLegacyPage.gateBody
    : failedCount > 0
      ? "优先处理异常通道，再核对摄像头、网络和播放链路。"
      : loadingCount > 0
        ? "视频通道仍在初始化，先等首轮播放状态稳定。"
        : "当前可直接从流卡片定位异常，再核对摄像头和网络状态。";
  const videoWorkspaceMeta = [
    "接入 已配置",
    "播放链路 已配置",
    `范围 ${zhCN.videoLegacyPage.detailScopeValue}`,
    `账号 ${isAllowedUser ? session?.username || "已授权" : "受限"}`
  ];

  return (
    <div className="video-legacy-page page-enter">
      <section className="video-legacy-header subpage-command-board">
        <div className="video-command-copy subpage-command-copy">
          <p className="video-command-eyebrow">视频接入状态</p>
          <h2>{zhCN.videoLegacyPage.heading}</h2>
          <p>先看接入状态，再看每路通道是否已播放，最后处理摄像头或网络异常。</p>
          <div className="video-command-tags">
            {videoCommandTags.map((item) => (
              <span key={item.label}>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </span>
            ))}
          </div>
        </div>
        <div className="video-command-side subpage-command-side">
          <div className="video-command-note">
            <strong>{bannerSummary}</strong>
            <p>{videoWorkspaceBody}</p>
          </div>
          <div className="video-command-statuses">
            <StatusPill label={accessLabel} tone={!isAllowedUser || scriptState === "failed" ? "warn" : scriptState === "ready" ? "good" : "neutral"} />
            <StatusPill label={`${playingCount}/${streams.length} 路播放`} tone={playingCount > 0 ? "good" : "neutral"} />
            <StatusPill label={`${failedCount} 路异常`} tone={failedCount > 0 ? "warn" : "neutral"} />
          </div>
          <div className="video-command-lines">
            {detailLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="video-stream-stage">
        <div className="video-stream-stage-copy">
          <strong>{videoWorkspaceTitle}</strong>
          <p>{videoWorkspaceBody}</p>
        </div>
        <div className="video-stream-stage-meta">
          {videoWorkspaceMeta.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      {!isAllowedUser ? (
        <SectionCard title={zhCN.videoLegacyPage.sectionGate}>
          <div className="video-legacy-empty">
            <strong>{zhCN.videoLegacyPage.gateTitle}</strong>
            <p>{zhCN.videoLegacyPage.gateBody}</p>
            <p>仅允许指定账号打开这组视频流，避免非授权用户误操作。</p>
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
                    <small>{`通道 ${index + 1} · 已配置`}</small>
                    <small>{`播放方式：${stream.renderMode === "video" ? "视频直出" : "画布解码"}`}</small>
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
                    <small>固定协议，不会自动切换。</small>
                  </article>
                  <article>
                    <label>通道配置</label>
                    <strong>已配置</strong>
                    <small>出流异常时优先核对摄像头和网络可达性。</small>
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
