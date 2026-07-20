// Iron Screens — Vídeo próprio tocado via WebView (Native)
// Usado só quando a rotação simulada está ativa: o player nativo de vídeo
// (expo-video / VideoView) não respeita a rotação por transform nesse
// hardware mesmo com surfaceType="textureView" — mas o WebView (usado pro
// YouTube/Instagram) respeita certinho, porque é uma única camada de
// hardware que participa do pipeline normal de composição. Reaproveitamos
// esse mesmo mecanismo pra vídeos próprios (upload direto no sistema).
import React, { memo, useCallback, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

interface WebVideoRendererProps {
  uri: string;
  durationSec?: number;
  onEnd?: () => void;
}

const DEFAULT_WATCHDOG_MS = 120000;
const END_MARGIN_MS = 500;

function buildHtml(uri: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin:0; padding:0; background:#000; overflow:hidden; width:100%; height:100%; }
  /* position:fixed em vídeo com aceleração de hardware tem histórico de
     "escapar" do compositing normal da WebView no Android, ignorando
     transforms aplicados de fora (é exatamente o sintoma relatado: a
     WebView gira certo, o <video> dentro dela não). position:absolute
     dentro de um container relative não tem esse problema. */
  .wrap { position:absolute; inset:0; width:100%; height:100%; }
  video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; background:#000; }
</style>
</head>
<body>
  <div class="wrap">
    <video id="v" src="${uri}" autoplay muted playsinline webkit-playsinline></video>
  </div>
  <script>
    (function() {
      var v = document.getElementById('v');
      var endSent = false;

      function send(obj) {
        try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch (e) {}
      }

      function notifyEnd() {
        if (endSent) return;
        endSent = true;
        send({ type: 'ENDED' });
      }

      v.addEventListener('ended', notifyEnd);
      v.addEventListener('error', function() {
        setTimeout(notifyEnd, 700);
      });
      v.addEventListener('loadedmetadata', function() {
        if (v.duration && isFinite(v.duration) && v.duration > 0) {
          send({ type: 'DURATION', value: v.duration });
        }
      });

      // Alguns WebViews exigem um play() explícito mesmo com autoplay+muted.
      var playPromise = v.play();
      if (playPromise && playPromise.catch) playPromise.catch(function() {});
    })();
  </script>
</body>
</html>`;
}

function WebVideoRenderer({ uri, durationSec, onEnd }: WebVideoRendererProps) {
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const endCalledRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerEnd = useCallback(() => {
    if (endCalledRef.current) return;
    endCalledRef.current = true;
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    onEndRef.current?.();
  }, []);

  const armWatchdog = useCallback((ms: number) => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(triggerEnd, ms);
  }, [triggerEnd]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(e.nativeEvent.data);
        if (msg.type === "ENDED") {
          triggerEnd();
        } else if (msg.type === "DURATION" && typeof msg.value === "number" && msg.value > 0) {
          armWatchdog(msg.value * 1000 + END_MARGIN_MS);
        }
      } catch {
        if (e.nativeEvent.data === "ENDED") triggerEnd();
      }
    },
    [triggerEnd, armWatchdog],
  );

  const onLoadEnd = useCallback(() => {
    // Watchdog de segurança inicial (substituído pelo real assim que
    // soubermos a duração real do vídeo via evento loadedmetadata).
    const fallbackMs =
      durationSec && durationSec > 0 ? durationSec * 1000 + END_MARGIN_MS : DEFAULT_WATCHDOG_MS;
    armWatchdog(fallbackMs);
  }, [durationSec, armWatchdog]);

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: buildHtml(uri) }}
        style={styles.webview}
        onMessage={onMessage}
        onLoadEnd={onLoadEnd}
        // ─── Força composição por software: elimina de vez qualquer chance
        // de uma camada de vídeo acelerada por hardware "escapar" da
        // rotação aplicada de fora (RotatedViewport). Custa um pouco mais
        // de CPU, mas garante que o vídeo respeite o transform igual a
        // qualquer outra view comum.
        androidLayerType="software"
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        allowsFullscreenVideo={false}
        originWhitelist={["*"]}
        mixedContentMode="always"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "#000" },
});

export default memo(WebVideoRenderer);
